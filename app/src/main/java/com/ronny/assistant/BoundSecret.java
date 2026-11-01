package com.ronny.assistant;

/** Encodes a key and binds it to the exact endpoint before encryption. */
final class BoundSecret {
    private static final String PREFIX = "ronny-key-v2:";
    static String encode(String endpoint, String key) {
        return PREFIX + endpoint.length() + ":" + endpoint + key;
    }
    static String forEndpoint(String value, String endpoint) {
        if (!value.startsWith(PREFIX)) return ""; // older unbound keys must be re-entered
        int colon = value.indexOf(':', PREFIX.length());
        if (colon < 0) return "";
        try {
            int length = Integer.parseInt(value.substring(PREFIX.length(), colon));
            int start = colon + 1;
            if (length < 1 || length > value.length() - start) return "";
            if (!value.regionMatches(start, endpoint, 0, length) || endpoint.length() != length) return "";
            return value.substring(start + length);
        } catch (NumberFormatException e) { return ""; }
    }
}
