import WatchKit

// SwiftUI on watchOS has no built-in dictation control, so we drop down to
// WatchKit's text input controller (voice + Scribble + presets), which is
// the standard bridge point documented for presenting dictation from a
// SwiftUI-only watch app.
func presentDictation(completion: @escaping (String?) -> Void) {
    guard let controller = WKExtension.shared().visibleInterfaceController else {
        completion(nil)
        return
    }

    controller.presentTextInputController(
        withSuggestions: nil,
        allowedInputMode: .plain
    ) { results in
        guard let text = (results?.first as? String) else {
            completion(nil)
            return
        }
        completion(text)
    }
}
