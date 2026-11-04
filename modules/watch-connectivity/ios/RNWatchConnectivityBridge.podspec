require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'RNWatchConnectivityBridge'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'evgenypavlovd'
  s.homepage       = 'https://github.com/evgenypavlovd/calorie-tracker'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  # Named to avoid colliding with Apple's own WatchConnectivity.framework
  # module (a pod named "WatchConnectivity" shadows it and breaks
  # `import WatchConnectivity` inside this very file).
  s.frameworks = 'WatchConnectivity'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
