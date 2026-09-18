package social.flotilla.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.util.Log
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.app.ActivityManager
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import social.flotilla.notifications.AndroidPushFallbackPlugin.Companion.KEY_STATE
import social.flotilla.notifications.AndroidPushFallbackPlugin.Companion.PREFS_NAME
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Arrays
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import android.util.Base64

class AndroidPushFallbackWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  companion object {
    private const val TAG = "PushFallback"
    private const val CHANNEL_ID = "flotilla_fallback"
    private const val CURSOR_PREFIX = "androidPushFallback.cursor."
    private const val SOCKET_TIMEOUT_SECONDS = 30L
    private const val REJECTED = "__REJECTED__"
    private const val KIND_RELAY_AUTH = 22242
    private const val KIND_NIP46_RPC = 24133
    private val SECP = fallbackSecp256k1
  }

  private val prefs: SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  private val client: OkHttpClient = OkHttpClient.Builder().build()

  // ---- Socket pool ----

  // Opens each relay URL at most once; caller must invoke closeAll() when done.
  private inner class SocketPool {
    private val sockets = ConcurrentHashMap<String, WebSocket>()

    fun open(url: String, listener: WebSocketListener): WebSocket =
      sockets.getOrPut(url) {
        client.newWebSocket(Request.Builder().url(url).build(), listener)
      }

    fun closeAll() {
      for ((_, ws) in sockets) ws.close(1000, "done")
      sockets.clear()
    }
  }

  override fun doWork(): Result {
    Log.i(TAG, "doWork() started")

    if (isAppInForeground()) {
      return Result.success()
    }

    val pool = SocketPool()
    try {
      val rawState = prefs.getString(KEY_STATE, "") ?: ""
      if (rawState.isEmpty()) return Result.success()

      val state = JSONObject(rawState)
      val sessionInfo = getSessionInfo(state)
      val subscriptions = parseSubscriptions(state)
      if (subscriptions.isEmpty()) return Result.success()

      val activeSince = state.optLong("activeSince", 0L)
      val seen = mutableSetOf<String>()
      val newEvents = mutableListOf<Pair<String, JSONObject>>()

      for (sub in subscriptions) {
        val cursorKey = CURSOR_PREFIX + sub.relay + ":" + sub.key
        val since = maxOf(prefs.getLong(cursorKey, 0L), activeSince)
        val result = pollRelay(sub, since, sessionInfo, pool)

        if (result.lastCursor > prefs.getLong(cursorKey, 0L)) {
          prefs.edit().putLong(cursorKey, result.lastCursor).apply()
        }

        for (event in result.events) {
          val id = event.optString("id", "")
          if (id.isNotEmpty() && seen.add(id)) {
            newEvents.add(Pair(sub.relay, event))
          }
        }
      }

      for ((relay, event) in newEvents) {
        postNotification(relay, event)
      }

      return Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "Worker failed", e)
      return Result.retry()
    } finally {
      pool.closeAll()
      client.dispatcher.executorService.shutdown()
    }
  }

  private fun isAppInForeground(): Boolean {
    val am = applicationContext.getSystemService(ActivityManager::class.java) ?: return false
    val tasks = am.getRunningAppProcesses() ?: return false
    val pkg = applicationContext.packageName
    return tasks.any { it.processName == pkg && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND }
  }

  private fun getSessionInfo(state: JSONObject): SessionInfo {
    val session = state.optJSONObject("session") ?: return SessionInfo("anonymous", "", JSONObject())
    return SessionInfo(
      session.optString("method", "anonymous"),
      state.optString("pubkey", ""),
      session.optJSONObject("data") ?: JSONObject(),
    )
  }

  private fun parseSubscriptions(state: JSONObject): List<Subscription> {
    val result = mutableListOf<Subscription>()
    val arr = state.optJSONArray("subscriptions") ?: return result

    for (i in 0 until arr.length()) {
      val item = arr.optJSONObject(i) ?: continue
      val relay = item.optString("relay", "").trim()

      if (!relay.startsWith("wss://") && !relay.startsWith("ws://")) continue

      val filters = item.optJSONArray("filters")
      if (filters == null || filters.length() == 0) continue

      val key = item.optString("key", "").trim()
      result.add(Subscription(relay, key, filters, item.optJSONArray("ignore")))
    }

    return result
  }

  private fun pollRelay(sub: Subscription, since: Long, sessionInfo: SessionInfo, pool: SocketPool): RelayResult {
    val result = RelayResult()
    val latch = CountDownLatch(1)

    val listener = RelayListener(sub, since, sessionInfo, result, latch, pool)
    pool.open(sub.relay, listener)

    if (!latch.await(SOCKET_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
      Log.d(TAG, "Relay ${sub.relay} timed out")
    }

    return result
  }

  private fun postNotification(relay: String, event: JSONObject) {
    val context = applicationContext

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(CHANNEL_ID, "Fallback Notifications", NotificationManager.IMPORTANCE_DEFAULT)
        channel.description = "Notifications delivered by Android background fallback"
        manager.createNotificationChannel(channel)
      }
    }

    val id = event.optString("id", "")
    val encodedRelay = Uri.encode(relay)
    val url = "https://app.flotilla.social/?relay=$encodedRelay&id=$id"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    intent.setPackage(context.packageName)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP

    val pendingIntent = PendingIntent.getActivity(
      context, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val body = "New activity"

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle("Flotilla")
      .setContentText(body)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setContentIntent(pendingIntent)
      .build()

    val notificationId = id.hashCode().let { if (it == 0) 1 else it }
    NotificationManagerCompat.from(context).notify(notificationId, notification)
  }

  private fun matchesFilter(filter: JSONObject, event: JSONObject): Boolean {
    val kinds = filter.optJSONArray("kinds")
    if (kinds != null && kinds.length() > 0) {
      val kind = event.optInt("kind", -1)
      var found = false
      for (i in 0 until kinds.length()) {
        if (kinds.optInt(i, -1) == kind) { found = true; break }
      }
      if (!found) return false
    }

    val tags = event.optJSONArray("tags")
    val iter = filter.keys()
    while (iter.hasNext()) {
      val key = iter.next()
      if (!key.startsWith("#")) continue
      val tagName = key.substring(1)
      val allowed = filter.optJSONArray(key) ?: continue
      if (allowed.length() == 0) continue

      val allowedValues = mutableSetOf<String>()
      for (i in 0 until allowed.length()) {
        val v = allowed.optString(i, "")
        if (v.isNotEmpty()) allowedValues.add(v)
      }

      var matched = false
      if (tags != null) {
        for (i in 0 until tags.length()) {
          val tag = tags.optJSONArray(i) ?: continue
          if (tag.optString(0, "") == tagName && allowedValues.contains(tag.optString(1, ""))) {
            matched = true; break
          }
        }
      }
      if (!matched) return false
    }

    return true
  }

  // ---- Crypto helpers ----

  private fun computeEventId(event: JSONObject): String {
    return try {
      val serialized = JSONArray()
      serialized.put(0)
      serialized.put(event.optString("pubkey", ""))
      serialized.put(event.optLong("created_at", 0))
      serialized.put(event.optInt("kind", 0))
      serialized.put(event.optJSONArray("tags") ?: JSONArray())
      serialized.put(event.optString("content", ""))
      // JSONObject escapes forward slashes (/ -> \/), but NIP-01 event ID hashing
      // requires unescaped slashes. Replace them before hashing.
      val serializedStr = serialized.toString().replace("\\/", "/")
      bytesToHex(sha256(serializedStr.toByteArray(StandardCharsets.UTF_8)))
    } catch (_: Exception) {
      ""
    }
  }

  private fun deriveXOnlyPubkey(secretHex: String): String {
    val secret = hexToBytes(secretHex)
    if (secret.size != 32 || !SECP.secKeyVerify(secret)) return ""
    val pubkey65 = try { SECP.pubkeyCreate(secret) } catch (_: Exception) { return "" }
    if (pubkey65.size != 65) return ""
    return bytesToHex(Arrays.copyOfRange(pubkey65, 1, 33))
  }

  private fun schnorrSign(secretHex: String, messageHex: String): String {
    val sk = hexToBytes(secretHex)
    val msg = hexToBytes(messageHex)
    if (sk.size != 32 || msg.size != 32 || !SECP.secKeyVerify(sk)) return ""
    val aux = ByteArray(32).also { SecureRandom().nextBytes(it) }
    val sig = try { SECP.signSchnorr(msg, sk, aux) } catch (_: Exception) { return "" }
    if (sig.size != 64) return ""
    return bytesToHex(sig)
  }

  private fun sha256(input: ByteArray): ByteArray =
    try { MessageDigest.getInstance("SHA-256").digest(input) } catch (_: Exception) { ByteArray(32) }

  private fun hexToBytes(hex: String?): ByteArray {
    var s = hex?.trim()?.lowercase() ?: ""
    if (s.startsWith("0x")) s = s.substring(2)
    if (s.length % 2 == 1) s = "0$s"
    val bytes = ByteArray(s.length / 2)
    var i = 0
    while (i < s.length) {
      val hi = Character.digit(s[i], 16)
      val lo = Character.digit(s[i + 1], 16)
      if (hi < 0 || lo < 0) return ByteArray(0)
      bytes[i / 2] = ((hi shl 4) + lo).toByte()
      i += 2
    }
    return bytes
  }

  private fun bytesToHex(bytes: ByteArray): String {
    val hex = "0123456789abcdef".toCharArray()
    val chars = CharArray(bytes.size * 2)
    for (i in bytes.indices) {
      val v = bytes[i].toInt() and 0xFF
      chars[i * 2] = hex[v ushr 4]
      chars[i * 2 + 1] = hex[v and 0x0F]
    }
    return String(chars)
  }

  // ---- NIP-44 encryption (v2: ECDH + HKDF + ChaCha20 + HMAC-SHA256) ----

  private fun nip44ConversationKey(clientSecret: String, theirPubkey: String): ByteArray {
    val sk = hexToBytes(clientSecret)
    val pk = hexToBytes("02$theirPubkey")
    if (sk.size != 32 || pk.size != 33) return ByteArray(0)
    val shared = try { SECP.pubKeyTweakMul(pk, sk) } catch (_: Exception) { return ByteArray(0) }
    if (shared.size != 65) return ByteArray(0)
    val sharedX = Arrays.copyOfRange(shared, 1, 33)
    return hkdfExtract(sharedX, "nip44-v2".toByteArray(StandardCharsets.UTF_8))
  }

  private fun hkdfExtract(ikm: ByteArray, salt: ByteArray): ByteArray {
    val mac = javax.crypto.Mac.getInstance("HmacSHA256")
    mac.init(javax.crypto.spec.SecretKeySpec(salt, "HmacSHA256"))
    return mac.doFinal(ikm)
  }

  private fun hkdfExpand(prk: ByteArray, info: ByteArray, length: Int): ByteArray {
    val mac = javax.crypto.Mac.getInstance("HmacSHA256")
    val result = ByteArray(length)
    var prev = ByteArray(0)
    var offset = 0
    var counter = 1
    while (offset < length) {
      mac.init(javax.crypto.spec.SecretKeySpec(prk, "HmacSHA256"))
      mac.update(prev)
      mac.update(info)
      mac.update(counter.toByte())
      prev = mac.doFinal()
      val toCopy = minOf(prev.size, length - offset)
      System.arraycopy(prev, 0, result, offset, toCopy)
      offset += toCopy
      counter++
    }
    return result
  }

  private fun hmacSha256(key: ByteArray, vararg parts: ByteArray): ByteArray {
    val mac = javax.crypto.Mac.getInstance("HmacSHA256")
    mac.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
    for (part in parts) mac.update(part)
    return mac.doFinal()
  }

  // ChaCha20 block function per RFC 8439
  private fun chacha20Block(key: ByteArray, counter: Int, nonce: ByteArray): ByteArray {
    fun Int.rotl(n: Int) = (this shl n) or (this ushr (32 - n))
    val state = IntArray(16)
    state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574
    for (i in 0..7) state[4 + i] = (key[i*4].toInt() and 0xFF) or
      ((key[i*4+1].toInt() and 0xFF) shl 8) or
      ((key[i*4+2].toInt() and 0xFF) shl 16) or
      ((key[i*4+3].toInt() and 0xFF) shl 24)
    state[12] = counter
    for (i in 0..2) state[13 + i] = (nonce[i*4].toInt() and 0xFF) or
      ((nonce[i*4+1].toInt() and 0xFF) shl 8) or
      ((nonce[i*4+2].toInt() and 0xFF) shl 16) or
      ((nonce[i*4+3].toInt() and 0xFF) shl 24)
    val working = state.copyOf()
    repeat(10) {
      fun quarterRound(a: Int, b: Int, c: Int, d: Int) {
        working[a] += working[b]; working[d] = (working[d] xor working[a]).rotl(16)
        working[c] += working[d]; working[b] = (working[b] xor working[c]).rotl(12)
        working[a] += working[b]; working[d] = (working[d] xor working[a]).rotl(8)
        working[c] += working[d]; working[b] = (working[b] xor working[c]).rotl(7)
      }
      quarterRound(0,4,8,12); quarterRound(1,5,9,13); quarterRound(2,6,10,14); quarterRound(3,7,11,15)
      quarterRound(0,5,10,15); quarterRound(1,6,11,12); quarterRound(2,7,8,13); quarterRound(3,4,9,14)
    }
    val out = ByteArray(64)
    for (i in 0..15) {
      val v = working[i] + state[i]
      out[i*4]   = v.toByte()
      out[i*4+1] = (v ushr 8).toByte()
      out[i*4+2] = (v ushr 16).toByte()
      out[i*4+3] = (v ushr 24).toByte()
    }
    return out
  }

  private fun chacha20(key: ByteArray, nonce: ByteArray, data: ByteArray): ByteArray {
    val out = ByteArray(data.size)
    var counter = 0
    var offset = 0
    while (offset < data.size) {
      val block = chacha20Block(key, counter, nonce)
      val len = minOf(64, data.size - offset)
      for (i in 0 until len) out[offset + i] = (data[offset + i].toInt() xor block[i].toInt()).toByte()
      offset += len
      counter++
    }
    return out
  }

  private fun nip44CalcPaddedLen(len: Int): Int {
    if (len <= 32) return 32
    val nextPower = 1 shl (Math.floor(Math.log((len - 1).toDouble()) / Math.log(2.0)).toInt() + 1)
    val chunk = if (nextPower <= 256) 32 else nextPower / 8
    return chunk * ((len - 1) / chunk + 1)
  }

  private fun nip44Pad(plaintext: String): ByteArray {
    val unpadded = plaintext.toByteArray(StandardCharsets.UTF_8)
    val len = unpadded.size
    val padded = ByteArray(2 + nip44CalcPaddedLen(len))
    padded[0] = (len ushr 8).toByte()
    padded[1] = len.toByte()
    System.arraycopy(unpadded, 0, padded, 2, len)
    return padded
  }

  private fun nip44Unpad(padded: ByteArray): String {
    val len = ((padded[0].toInt() and 0xFF) shl 8) or (padded[1].toInt() and 0xFF)
    if (len == 0 || len > padded.size - 2) return ""
    return String(padded, 2, len, StandardCharsets.UTF_8)
  }

  private fun encryptNip44(plaintext: String, conversationKey: ByteArray): String {
    return try {
      val nonce = ByteArray(32).also { SecureRandom().nextBytes(it) }
      val keys = hkdfExpand(conversationKey, nonce, 76)
      val chachaKey = keys.sliceArray(0 until 32)
      val chachaNonce = keys.sliceArray(32 until 44)
      val hmacKey = keys.sliceArray(44 until 76)
      val padded = nip44Pad(plaintext)
      val ciphertext = chacha20(chachaKey, chachaNonce, padded)
      val mac = hmacSha256(hmacKey, nonce, ciphertext)
      val payload = ByteArray(1 + 32 + ciphertext.size + 32)
      payload[0] = 2
      System.arraycopy(nonce, 0, payload, 1, 32)
      System.arraycopy(ciphertext, 0, payload, 33, ciphertext.size)
      System.arraycopy(mac, 0, payload, 33 + ciphertext.size, 32)
      Base64.encodeToString(payload, Base64.NO_WRAP)
    } catch (_: Exception) {
      ""
    }
  }

  private fun decryptNip44(payload: String, conversationKey: ByteArray): String {
    return try {
      if (payload.isEmpty() || payload[0] == '#') return ""
      val data = Base64.decode(payload, Base64.NO_WRAP)
      if (data.size < 99 || data[0] != 2.toByte()) return ""
      val nonce = data.sliceArray(1 until 33)
      val ciphertext = data.sliceArray(33 until data.size - 32)
      val mac = data.sliceArray(data.size - 32 until data.size)
      val keys = hkdfExpand(conversationKey, nonce, 76)
      val chachaKey = keys.sliceArray(0 until 32)
      val chachaNonce = keys.sliceArray(32 until 44)
      val hmacKey = keys.sliceArray(44 until 76)
      val expectedMac = hmacSha256(hmacKey, nonce, ciphertext)
      if (!expectedMac.contentEquals(mac)) return ""
      val padded = chacha20(chachaKey, chachaNonce, ciphertext)
      nip44Unpad(padded)
    } catch (_: Exception) {
      ""
    }
  }

  // ---- Signing ----

  private fun signWithNip01Secret(secretHex: String, eventJson: String, expectedPubkey: String): String {
    return try {
      val secret = hexToBytes(secretHex)
      if (secret.size != 32) return ""

      val event = JSONObject(eventJson)
      var pubkey = event.optString("pubkey", expectedPubkey)
      if (pubkey.isEmpty()) pubkey = deriveXOnlyPubkey(secretHex)
      if (pubkey.isEmpty()) return ""

      event.put("pubkey", pubkey)
      val id = computeEventId(event)
      if (id.isEmpty()) return ""

      val sig = schnorrSign(secretHex, id)
      if (sig.isEmpty()) return ""

      event.put("id", id)
      event.put("sig", sig)
      event.toString()
    } catch (_: Exception) {
      ""
    }
  }

  private fun signWithNip55ContentResolver(packageName: String, eventJson: String, pubkey: String): String {
    val uri = Uri.parse("content://$packageName.SIGN_EVENT")
    var cursor: Cursor? = null
    return try {
      cursor = applicationContext.contentResolver.query(uri, arrayOf(eventJson, "", pubkey), "1", null, null)
      if (cursor == null || !cursor.moveToFirst()) return ""
      val rejIdx = cursor.getColumnIndex("rejected")
      if (rejIdx >= 0) {
        val v = cursor.getString(rejIdx)
        if (v == "1" || v.equals("true", ignoreCase = true)) return REJECTED
      }
      val eventIdx = cursor.getColumnIndex("event")
      if (eventIdx >= 0) cursor.getString(eventIdx) ?: "" else ""
    } catch (_: Exception) {
      ""
    } finally {
      cursor?.close()
    }
  }

  // ---- Data types ----

  private data class SessionInfo(
    val method: String,
    val pubkey: String,
    val data: JSONObject,
  )

  private data class Subscription(
    val relay: String,
    val key: String,
    val filters: JSONArray,
    val ignore: JSONArray?,
  )

  private class RelayResult {
    val events = mutableListOf<JSONObject>()
    var lastCursor = 0L
  }

  // ---- Relay listener ----

  private inner class RelayListener(
    private val sub: Subscription,
    private val since: Long,
    private val sessionInfo: SessionInfo,
    private val result: RelayResult,
    private val latch: CountDownLatch,
    private val pool: SocketPool,
  ) : WebSocketListener() {
    private val subId = UUID.randomUUID().toString().replace("-", "")
    private var done = false
    private var authed = false
    private var authEventId = ""
    private var nip46InFlight = false
    private var pendingDone = false

    override fun onOpen(webSocket: WebSocket, response: Response) {
      sendReq(webSocket)
    }

    private fun sendReq(webSocket: WebSocket) {
      val req = JSONArray()
      req.put("REQ")
      req.put(subId)

      for (i in 0 until sub.filters.length()) {
        val filter = sub.filters.optJSONObject(i) ?: continue
        val shaped = JSONObject(filter.toString())
        if (since > 0) shaped.put("since", since + 1)
        shaped.put("limit", 1)
        req.put(shaped)
      }

      if (req.length() <= 2) { finish(); return }

      send(webSocket, req.toString())
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
      try {
        val message = JSONArray(text)
        Log.d(TAG, "Received message from ${sub.relay}: $text")
        when (message.optString(0, "")) {
          "EVENT" -> {
            val event = message.optJSONObject(2) ?: return
            if (!matchesAnyFilter(sub.filters, event)) return
            if (isIgnored(event)) return
            result.events.add(event)
            val createdAt = event.optLong("created_at", 0L)
            if (createdAt > result.lastCursor) result.lastCursor = createdAt
          }
          "AUTH" -> {
            // Only auth once per connection
            if (!authed) {
              authed = true
              tryAuth(webSocket, message.optString(1, ""))
            }
          }
          "OK" -> {
            val okId = message.optString(1, "")
            val accepted = message.optBoolean(2, false)
            if (accepted && okId == authEventId) sendReq(webSocket)
          }
          "EOSE" -> {
            send(webSocket, JSONArray().apply { put("CLOSE"); put(subId) }.toString())
            finish()
          }
        }
      } catch (_: Exception) {
        finish()
      }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = finish()
    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = finish()

    private fun finish() {
      if (done) return
      if (nip46InFlight) { pendingDone = true; return }
      done = true
      latch.countDown()
    }

    private fun isIgnored(event: JSONObject): Boolean {
      val ignore = sub.ignore ?: return false
      for (i in 0 until ignore.length()) {
        val filter = ignore.optJSONObject(i) ?: continue
        if (matchesFilter(filter, event)) return true
      }
      return false
    }

    private fun matchesAnyFilter(filters: JSONArray, event: JSONObject): Boolean {
      for (i in 0 until filters.length()) {
        val filter = filters.optJSONObject(i) ?: continue
        if (matchesFilter(filter, event)) return true
      }
      return false
    }

    // ---- NIP-42 auth ----

    private fun tryAuth(webSocket: WebSocket, challenge: String) {
      if (challenge.isEmpty()) return
      when (sessionInfo.method) {
        "nip01" -> tryNip01Auth(webSocket, challenge)
        "nip55" -> tryNip55Auth(webSocket, challenge)
        "nip46" -> tryNip46Auth(webSocket, challenge)
        // Pomade background auth is not supported: properly delegating to the Pomade signer
        // from a background worker is complex, usage is rare, and relays that require auth
        // may still be readable without it.
      }
    }

    private fun buildAuthEvent(challenge: String): JSONObject {
      return JSONObject().apply {
        put("kind", KIND_RELAY_AUTH)
        put("pubkey", sessionInfo.pubkey)
        put("created_at", System.currentTimeMillis() / 1000L)
        put("content", "")
        put("id", "")
        put("sig", "")
        put("tags", JSONArray().apply {
          put(JSONArray().apply { put("relay"); put(sub.relay) })
          put(JSONArray().apply { put("challenge"); put(challenge) })
        })
      }
    }

    private fun sendAuthMessage(webSocket: WebSocket, signedEventJson: String): Boolean {
      if (signedEventJson.isEmpty() || signedEventJson == REJECTED) return false
      return try {
        val event = JSONObject(signedEventJson)
        authEventId = event.optString("id", "")
        send(webSocket, JSONArray().apply { put("AUTH"); put(event) }.toString())
      } catch (_: Exception) {
        false
      }
    }

    private fun send(webSocket: WebSocket, message: String): Boolean {
      Log.d(TAG, "Sending message to ${webSocket.request().url}: $message")
      return webSocket.send(message)
    }

    private fun tryNip01Auth(webSocket: WebSocket, challenge: String): Boolean {
      val secret = sessionInfo.data.optString("secret", "")
      if (secret.isEmpty()) return false
      val signed = signWithNip01Secret(secret, buildAuthEvent(challenge).toString(), sessionInfo.pubkey)
      return sendAuthMessage(webSocket, signed)
    }

    private fun tryNip55Auth(webSocket: WebSocket, challenge: String): Boolean {
      val signerPackage = sessionInfo.data.optString("signer", "")
      if (signerPackage.isEmpty()) return false
      val signed = signWithNip55ContentResolver(signerPackage, buildAuthEvent(challenge).toString(), sessionInfo.pubkey)
      return sendAuthMessage(webSocket, signed)
    }

    private fun tryNip46Auth(webSocket: WebSocket, challenge: String): Boolean {
      val clientSecret = sessionInfo.data.optString("clientSecret", "")
      val signerPubkey = sessionInfo.data.optString("signerPubkey", "")
      val relays = sessionInfo.data.optJSONArray("relays")

      if (clientSecret.isEmpty() || signerPubkey.isEmpty() || relays == null || relays.length() == 0) return false

      val clientPubkey = deriveXOnlyPubkey(clientSecret)
      if (clientPubkey.isEmpty()) return false

      val authEventJson = buildAuthEvent(challenge).toString()

      nip46InFlight = true
      var success = false
      try {
        for (i in 0 until relays.length()) {
          val signerRelay = relays.optString(i, "").trim()
          if (!signerRelay.startsWith("wss://") && !signerRelay.startsWith("ws://")) continue
          if (tryNip46ViaRelay(webSocket, signerRelay, clientSecret, clientPubkey, signerPubkey, authEventJson)) { success = true; break }
        }
      } finally {
        nip46InFlight = false
        if (pendingDone) finish()
      }

      return success
    }

    private fun tryNip46ViaRelay(
      relaySocket: WebSocket,
      signerRelay: String,
      clientSecret: String,
      clientPubkey: String,
      signerPubkey: String,
      authEventJson: String,
    ): Boolean {
      val localLatch = CountDownLatch(1)
      val signedEvent = StringBuilder()
      val requestId = UUID.randomUUID().toString().replace("-", "")

      val signerSocket = pool.open(signerRelay, object : WebSocketListener() {
        private var done = false

        override fun onOpen(webSocket: WebSocket, response: Response) {
          try {
            val rpcEnvelope = JSONObject().apply {
              put("kind", KIND_NIP46_RPC)
              put("pubkey", clientPubkey)
              put("created_at", System.currentTimeMillis() / 1000L)
              put("content", encryptNip44(
                JSONObject().apply {
                  put("id", requestId)
                  put("method", "sign_event")
                  put("params", JSONArray().apply { put(authEventJson) })
                }.toString(),
                nip44ConversationKey(clientSecret, signerPubkey),
              ))
              put("id", "")
              put("sig", "")
              put("tags", JSONArray().apply { put(JSONArray().apply { put("p"); put(signerPubkey) }) })
            }

            val signedEnvelope = signWithNip01Secret(clientSecret, rpcEnvelope.toString(), clientPubkey)
            if (signedEnvelope.isEmpty()) { finish(); return }

            val sentAt = System.currentTimeMillis() / 1000L
            send(webSocket, JSONArray().apply { put("EVENT"); put(JSONObject(signedEnvelope)) }.toString())
            send(webSocket, JSONArray().apply {
              put("REQ")
              put(requestId)
              put(JSONObject().apply {
                put("#p", JSONArray().apply { put(clientPubkey) })
                put("kinds", JSONArray().apply { put(KIND_NIP46_RPC) })
                put("since", sentAt)
                put("limit", 10)
              })
            }.toString())
          } catch (_: Exception) {
            finish()
          }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
          try {
            val message = JSONArray(text)
            val msgType = message.optString(0, "")
            Log.d(TAG, "NIP-46 signer message: $msgType from ${webSocket.request().url}")
            if (msgType != "EVENT") return
            val event = message.optJSONObject(2) ?: return

            val tags = event.optJSONArray("tags")
            var hasP = false
            if (tags != null) {
              for (i in 0 until tags.length()) {
                val tag = tags.optJSONArray(i) ?: continue
                if (tag.optString(0, "") == "p" && tag.optString(1, "") == clientPubkey) { hasP = true; break }
              }
            }
            if (!hasP) { Log.d(TAG, "NIP-46 event missing p tag for client"); return }

            val decryptedContent = decryptNip44(event.optString("content", ""), nip44ConversationKey(clientSecret, signerPubkey))
            Log.d(TAG, "NIP-46 decrypted response: $decryptedContent")
            if (decryptedContent.isEmpty()) return
            val payload = JSONObject(decryptedContent)
            if (requestId == payload.optString("id", "")) {
              val result = payload.optString("result", "")
              if (result.isNotEmpty()) {
                signedEvent.setLength(0)
                signedEvent.append(result)
                finish()
              }
            }
          } catch (e: Exception) {
            Log.e(TAG, "NIP-46 signer message error", e)
          }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = finish()
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = finish()

        private fun finish() {
          if (!done) { done = true; localLatch.countDown() }
        }
      })

      try {
        localLatch.await(5, TimeUnit.SECONDS)
      } catch (_: InterruptedException) {
        return false
      }

      if (signedEvent.isEmpty()) return false

      val authEvent = JSONObject(signedEvent.toString())
      authEventId = authEvent.optString("id", "")
      val authMessage = JSONArray().apply { put("AUTH"); put(authEvent) }.toString()
      Log.d(TAG, "NIP-46 sending AUTH to relay ${relaySocket.request().url}: $authMessage")
      return try {
        relaySocket.send(authMessage)
      } catch (e: Exception) {
        Log.e(TAG, "NIP-46 failed to send AUTH", e)
        false
      }
    }
  }
}
