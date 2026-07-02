/**
 * Project-specific webpack adjustments.
 *
 * The Joplin plugin generator may replace webpack.config.js during framework
 * updates. Keep local build tweaks here so they are easy to re-apply.
 */

module.exports = function overrideWebpackConfig(configs) {
    const buildMainConfigs = configs.buildMain || [];

    for (const config of buildMainConfigs) {
        for (const plugin of config.plugins || []) {
            if (!Array.isArray(plugin.patterns)) continue;

            for (const pattern of plugin.patterns) {
                pattern.globOptions = pattern.globOptions || {};
                const ignore = pattern.globOptions.ignore || [];
                pattern.globOptions.ignore = [...ignore, '**/*.test.*', '**/__tests__/**', '**/fixtures/**'];
            }
        }
    }

    return configs;
};
