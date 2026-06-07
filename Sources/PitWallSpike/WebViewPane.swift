import PitWallSpikeCore
import SwiftUI
import WebKit

struct WebViewPane: NSViewRepresentable {
    let url: URL
    let onEvent: (ProbeEvent) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onEvent: onEvent)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(context.coordinator, name: "pitwallProbe")
        configuration.userContentController.addUserScript(WKUserScript(
            source: ProbeScript.source,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onEvent: (ProbeEvent) -> Void

        init(onEvent: @escaping (ProbeEvent) -> Void) {
            self.onEvent = onEvent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let payload = message.body as? [String: Any],
                  let event = try? ProbeEvent(payload: payload) else {
                return
            }
            onEvent(event)
        }
    }
}
