package social.flotilla.notifications

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.util.concurrent.TimeUnit

@CapacitorPlugin(
  name = "AndroidPushFallback",
  permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class AndroidPushFallbackPlugin : Plugin() {
  companion object {
    const val PREFS_NAME = "CapacitorStorage"
    const val KEY_STATE = "androidPushFallback.state"
    const val UNIQUE_PERIODIC_WORK = "androidPushFallback.periodic"
    const val UNIQUE_IMMEDIATE_WORK = "androidPushFallback.immediate"
  }

  private fun getPrefs(): SharedPreferences {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  @PluginMethod
  fun requestNotificationPermission(call: PluginCall) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
      call.resolve(JSObject().put("receive", "granted"))
    } else {
      requestPermissionForAlias("notifications", call, "permissionCallback")
    }
  }

  @PermissionCallback
  private fun permissionCallback(call: PluginCall) {
    val receive = if (getPermissionState("notifications") == PermissionState.GRANTED) "granted" else "denied"
    call.resolve(JSObject().put("receive", receive))
  }

  @PluginMethod
  fun syncState(call: PluginCall) {
    val state: JSObject? = call.getObject("state")

    if (state != null) {
      getPrefs().edit().putString(KEY_STATE, state.toString()).apply()

      if (isEnabled(state.toString())) {
        scheduleWork()
      } else {
        cancelWork()
      }
    }

    call.resolve()
  }

  private fun isEnabled(rawState: String?): Boolean {
    if (rawState == null || rawState.isEmpty()) {
      return false
    }

    return try {
      val state = JSONObject(rawState)
      val subscriptions: JSONArray? = state.optJSONArray("subscriptions")
      subscriptions != null && subscriptions.length() > 0
    } catch (_: JSONException) {
      false
    }
  }

  private fun scheduleWork() {
    val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    val workManager = WorkManager.getInstance(context)

    val periodic = PeriodicWorkRequest.Builder(
      AndroidPushFallbackWorker::class.java,
      15,
      TimeUnit.MINUTES,
    ).setConstraints(constraints).build()

    val immediate = OneTimeWorkRequest.Builder(AndroidPushFallbackWorker::class.java)
      .setConstraints(constraints)
      .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
      .build()

    workManager.enqueueUniquePeriodicWork(
      UNIQUE_PERIODIC_WORK,
      ExistingPeriodicWorkPolicy.UPDATE,
      periodic,
    )

    workManager.enqueueUniqueWork(
      UNIQUE_IMMEDIATE_WORK,
      ExistingWorkPolicy.REPLACE,
      immediate,
    )
  }

  private fun cancelWork() {
    val workManager = WorkManager.getInstance(context)
    workManager.cancelUniqueWork(UNIQUE_IMMEDIATE_WORK)
    workManager.cancelUniqueWork(UNIQUE_PERIODIC_WORK)
  }
}
