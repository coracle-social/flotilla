package social.flotilla;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import social.flotilla.notifications.AndroidPushFallbackPlugin;
import social.flotilla.screenshare.ScreenSharePlugin;
import social.flotilla.share.ShareIntentPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AndroidPushFallbackPlugin.class);
    registerPlugin(ScreenSharePlugin.class);
    registerPlugin(ShareIntentPlugin.class);
    createPushNotificationChannel();
    super.onCreate(savedInstanceState);
  }

  // Ensures the channel named by the FCM default_notification_channel_id metadata
  // exists. FCM does not create it for us; if it's missing when a notification
  // arrives, Android falls back to a generic "Miscellaneous" channel. Channels
  // persist once created, so doing this on launch is sufficient.
  private void createPushNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = getSystemService(NotificationManager.class);
      String id = getString(R.string.default_notification_channel_id);

      if (manager != null && manager.getNotificationChannel(id) == null) {
        NotificationChannel channel = new NotificationChannel(
          id,
          "Notifications",
          NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("New messages and activity");
        manager.createNotificationChannel(channel);
      }
    }
  }
}
