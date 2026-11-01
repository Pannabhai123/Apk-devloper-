package com.ronny.assistant;
public final class BoundSecretTest {
    private static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);}
    public static void main(String[] args) {
        String first="https://first.example/v1/chat/completions", second="https://second.example/v1/chat/completions";
        String value=BoundSecret.encode(first,"secret-value");
        check(BoundSecret.forEndpoint(value,first).equals("secret-value"),"same endpoint");
        check(BoundSecret.forEndpoint(value,second).isEmpty(),"different provider rejected");
        check(BoundSecret.forEndpoint(value,first+"/other").isEmpty(),"different path rejected");
        check(BoundSecret.forEndpoint("legacy-unbound-secret",first).isEmpty(),"legacy unbound value rejected");
        check(BoundSecret.forEndpoint("ronny-key-v2:999999999999999999999:a",first).isEmpty(),"overflow rejected");
        check(BoundSecret.forEndpoint("ronny-key-v2:-1:a",first).isEmpty(),"negative length rejected");
        check(BoundSecret.forEndpoint("ronny-key-v2:500:a",first).isEmpty(),"truncated value rejected");
        System.out.println("BoundSecret: 7 cases passed");
    }
}
