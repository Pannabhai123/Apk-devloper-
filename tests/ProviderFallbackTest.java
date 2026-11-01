package com.ronny.assistant;
public final class ProviderFallbackTest {
    private static void check(boolean b,String name){if(!b)throw new AssertionError(name);}
    public static void main(String[] args) throws Exception {
        int[] calls={0,0};
        String answer=ProviderFallback.run(new boolean[]{true,true},i->{calls[i]++;if(i==0)throw new Exception("HTTP 429 (rate limited)");return "second";});
        check(answer.equals("second")&&calls[0]==1&&calls[1]==1,"fallback after rate limit");
        calls[0]=calls[1]=0;
        answer=ProviderFallback.run(new boolean[]{true,true},i->{calls[i]++;return "first";});
        check(answer.equals("first")&&calls[0]==1&&calls[1]==0,"first success stops fallback");
        calls[0]=calls[1]=0;
        answer=ProviderFallback.run(new boolean[]{false,true},i->{calls[i]++;return "only configured";});
        check(answer.equals("only configured")&&calls[0]==0&&calls[1]==1,"skip disabled provider");
        answer=ProviderFallback.run(new boolean[]{true,true},i->i==0?"": "valid");check(answer.equals("valid"),"empty response falls back");
        try{ProviderFallback.run(new boolean[]{true,true},i->{throw new Exception("offline");});throw new AssertionError("failure returned success");}catch(Exception e){check(e.getMessage().contains("Provider 1: offline")&&e.getMessage().contains("Provider 2: offline"),"both failures reported");}
        try{ProviderFallback.run(new boolean[]{false,false},i->"bad");throw new AssertionError("unconfigured returned success");}catch(Exception e){check(e.getMessage().contains("No AI provider configured"),"no provider reported");}
        System.out.println("ProviderFallback: 6 cases passed");
    }
}
