package social.flotilla.audio

import android.content.Intent
import androidx.core.content.ContextCompat
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AudioPlayback")
class AudioPlaybackPlugin : Plugin() {
  @PluginMethod
  fun start(call: PluginCall) {
    try {
      ContextCompat.startForegroundService(context, Intent(context, AudioPlaybackService::class.java))
      call.resolve()
    } catch (error: IllegalStateException) {
      // Android refuses a foreground service to an app that is already in the background.
      call.reject("The app cannot hold a foreground service right now", error)
    }
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    context.stopService(Intent(context, AudioPlaybackService::class.java))
    call.resolve()
  }
}
