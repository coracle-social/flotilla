package social.flotilla.notifications

import java.math.BigInteger
import java.security.MessageDigest
import org.bouncycastle.asn1.sec.SECNamedCurves

class BouncyCastleFallbackSecp256k1 {
  private val curve = SECNamedCurves.getByName("secp256k1")

  fun secKeyVerify(secretKey: ByteArray) =
    secretKey.size == 32 && scalar(secretKey).let { it.signum() > 0 && it < curve.n }

  fun pubkeyCreate(secretKey: ByteArray): ByteArray {
    require(secKeyVerify(secretKey))
    return curve.g.multiply(scalar(secretKey)).normalize().getEncoded(false)
  }

  fun pubKeyTweakMul(publicKey: ByteArray, tweak: ByteArray): ByteArray {
    require(tweak.size == 32)
    val scalar = scalar(tweak)
    require(scalar.signum() > 0 && scalar < curve.n)
    val point = curve.curve.decodePoint(publicKey).multiply(scalar).normalize()
    require(!point.isInfinity)
    return point.getEncoded(false)
  }

  fun signSchnorr(
    message: ByteArray,
    secretKey: ByteArray,
    auxiliaryRandomness: ByteArray,
  ): ByteArray {
    require(message.size == 32 && auxiliaryRandomness.size == 32 && secKeyVerify(secretKey))

    val d0 = scalar(secretKey)
    val publicKey = curve.g.multiply(d0).normalize()
    val d = if (publicKey.affineYCoord.toBigInteger().testBit(0)) curve.n.subtract(d0) else d0
    val publicKeyX = bytes32(publicKey.affineXCoord.toBigInteger())
    val maskedSecret = xor(bytes32(d), taggedHash("BIP0340/aux", auxiliaryRandomness))
    val nonce = scalar(taggedHash("BIP0340/nonce", maskedSecret + publicKeyX + message)).mod(curve.n)
    require(nonce.signum() > 0)

    val noncePoint = curve.g.multiply(nonce).normalize()
    val k = if (noncePoint.affineYCoord.toBigInteger().testBit(0)) curve.n.subtract(nonce) else nonce
    val nonceX = bytes32(noncePoint.affineXCoord.toBigInteger())
    val challenge = scalar(taggedHash("BIP0340/challenge", nonceX + publicKeyX + message)).mod(curve.n)
    return nonceX + bytes32(k.add(challenge.multiply(d)).mod(curve.n))
  }

  private fun taggedHash(tag: String, input: ByteArray): ByteArray {
    val digest = MessageDigest.getInstance("SHA-256")
    val tagHash = digest.digest(tag.toByteArray(Charsets.UTF_8))
    return digest.digest(tagHash + tagHash + input)
  }

  private fun scalar(bytes: ByteArray) = BigInteger(1, bytes)

  private fun bytes32(value: BigInteger): ByteArray {
    val bytes = value.toByteArray()
    return when {
      bytes.size == 32 -> bytes
      bytes.size < 32 -> ByteArray(32 - bytes.size) + bytes
      else -> bytes.copyOfRange(bytes.size - 32, bytes.size)
    }
  }

  private fun xor(left: ByteArray, right: ByteArray) =
    ByteArray(left.size) { index -> (left[index].toInt() xor right[index].toInt()).toByte() }
}

val fallbackSecp256k1 = BouncyCastleFallbackSecp256k1()
