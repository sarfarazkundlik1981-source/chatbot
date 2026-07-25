import { env } from "../config/env.js";
import { compareVersions } from "./versioning.js";

export type CompatibilityStatus = "compatible" | "update_recommended" | "update_required" | "unsupported_environment";

export function evaluateCompatibility(input: {
  pluginVersion: string;
  wordpressVersion?: string;
  phpVersion?: string;
}): { status: CompatibilityStatus; details: Record<string, string> } {
  if (compareVersions(input.phpVersion, env.MINIMUM_PHP_VERSION) < 0) {
    return {
      status: "unsupported_environment",
      details: { minimum_php_version: env.MINIMUM_PHP_VERSION }
    };
  }

  if (compareVersions(input.wordpressVersion, env.MINIMUM_WORDPRESS_VERSION) < 0) {
    return {
      status: "unsupported_environment",
      details: { minimum_wordpress_version: env.MINIMUM_WORDPRESS_VERSION }
    };
  }

  if (compareVersions(input.pluginVersion, env.MINIMUM_SUPPORTED_PLUGIN_VERSION) < 0) {
    return {
      status: "update_required",
      details: { minimum_supported_plugin_version: env.MINIMUM_SUPPORTED_PLUGIN_VERSION }
    };
  }

  if (compareVersions(input.pluginVersion, env.RECOMMENDED_PLUGIN_VERSION) < 0) {
    return {
      status: "update_recommended",
      details: { recommended_plugin_version: env.RECOMMENDED_PLUGIN_VERSION }
    };
  }

  return { status: "compatible", details: {} };
}
