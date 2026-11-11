package social.flotilla.downloads

import android.webkit.URLUtil
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin

// The web view drops a download without a listener, so hand it to the web layer to fetch and save.
@CapacitorPlugin(name = "WebViewDownload")
class WebViewDownloadPlugin : Plugin() {
  override fun load() {
    bridge.webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
      notifyListeners(
        "downloadRequested",
        JSObject()
          .put("url", url)
          .put("name", URLUtil.guessFileName(url, contentDisposition, mimeType))
          .put("type", mimeType),
      )
    }
  }
}
