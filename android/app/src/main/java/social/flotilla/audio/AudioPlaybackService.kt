package social.flotilla.audio

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import social.flotilla.MainActivity
import social.flotilla.R

// Android freezes an app in the background and the web view's audio with it, so this holds the app up while something plays.
class AudioPlaybackService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      buildNotification(),
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
    )

    // The web view draws nothing with the screen off, so without this the cpu sleeps between buffers and the audio stutters.
    if (wakeLock == null) {
      val power = getSystemService(PowerManager::class.java)

      wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flotilla:audio").apply {
        setReferenceCounted(false)
        acquire()
      }
    }

    return START_NOT_STICKY
  }

  override fun onDestroy() {
    wakeLock?.release()
    wakeLock = null

    super.onDestroy()
  }

  private fun buildNotification(): Notification {
    NotificationManagerCompat.from(this).createNotificationChannel(
      NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
        .setName("Audio playback")
        .build(),
    )

    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle("Playing audio")
      .setContentIntent(open)
      .setOngoing(true)
      .setSilent(true)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "audio_playback"
    private const val NOTIFICATION_ID = 1
  }
}
