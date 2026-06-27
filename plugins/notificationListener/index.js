const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const KOTLIN_FILES = [
  'NotificationInterceptorService.kt',
  'NotificationListenerBridge.kt',
  'NotificationListenerPackage.kt',
];

function withNotificationListenerManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    if (!application.service) application.service = [];

    const alreadyAdded = application.service.some(
      (s) => s.$?.['android:name'] === '.NotificationInterceptorService'
    );

    if (!alreadyAdded) {
      application.service.push({
        $: {
          'android:name': '.NotificationInterceptorService',
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

function withNotificationListenerFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // Destination: android/app/src/main/java/com/glowbig/glowcash/
      const destDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'glowbig',
        'glowcash'
      );

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const sourceDir = path.join(__dirname, 'android');

      for (const file of KOTLIN_FILES) {
        const src = path.join(sourceDir, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      // Register package in MainApplication.kt
      const mainAppPath = path.join(destDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf8');

        if (!content.includes('NotificationListenerPackage')) {
          // Insert after PackageList line
          content = content.replace(
            'val packages = PackageList(this).packages',
            'val packages = PackageList(this).packages\n          packages.add(NotificationListenerPackage())'
          );
          fs.writeFileSync(mainAppPath, content, 'utf8');
        }
      }

      return config;
    },
  ]);
}

function withNotificationListener(config) {
  config = withNotificationListenerManifest(config);
  config = withNotificationListenerFiles(config);
  return config;
}

module.exports = withNotificationListener;
