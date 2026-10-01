package social.flotilla.screenshare

import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

// The web view cannot capture the screen, so it is published from a second connection.
@CapacitorPlugin(name = "ScreenShare")
class ScreenSharePlugin : Plugin() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var room: Room? = null

  @PluginMethod
  fun start(call: PluginCall) {
    if (room != null) {
      call.reject("Already sharing the screen")
      return
    }

    if (call.getString("serverUrl") == null || call.getString("token") == null) {
      call.reject("A server url and a token are required")
      return
    }

    val projections = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

    startActivityForResult(call, projections.createScreenCaptureIntent(), "onPermissionResult")
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    teardown()
    call.resolve()
  }

  @ActivityCallback
  private fun onPermissionResult(call: PluginCall, result: ActivityResult) {
    val permission = result.data

    if (result.resultCode != Activity.RESULT_OK || permission == null) {
      call.reject("Screen capture was declined", "cancelled")
      return
    }

    val serverUrl = call.getString("serverUrl")!!
    val token = call.getString("token")!!

    scope.launch {
      try {
        val room = LiveKit.create(context.applicationContext)

        this@ScreenSharePlugin.room = room
        room.connect(serverUrl, token)
        room.localParticipant.setScreenShareEnabled(
          true,
          ScreenCaptureParams(permission, onStop = ::onProjectionStopped),
        )
        call.resolve()
      } catch (e: Exception) {
        teardown()
        call.reject(e.message ?: "Could not start screen sharing")
      }
    }
  }

  // Android's own stop control ends the projection without telling the web view.
  private fun onProjectionStopped() {
    teardown()
    notifyListeners("screenShareStopped", JSObject())
  }

  private fun teardown() {
    room?.release()
    room = null
  }

  override fun handleOnDestroy() {
    teardown()
    scope.cancel()
  }
}
