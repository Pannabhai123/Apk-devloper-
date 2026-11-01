package com.ronny.assistant;

/** Executes configured providers sequentially; never invents an answer. */
final class ProviderFallback {
    interface Attempt { String run(int index) throws Exception; }
    static String run(boolean[] configured, Attempt attempt) throws Exception {
        StringBuilder failures = new StringBuilder();
        for(int i=0;i<configured.length;i++) {
            if(!configured[i]) continue;
            try {
                String result=attempt.run(i);
                if(result==null || result.trim().isEmpty()) throw new Exception("empty response");
                return result;
            } catch(Exception e) {
                if(failures.length()>0)failures.append("; ");
                failures.append("Provider ").append(i+1).append(": ").append(e.getMessage()==null?"unavailable":e.getMessage());
            }
        }
        throw new Exception(failures.length()==0?"No AI provider configured. Open Settings to add one; local commands still work.":"AI unavailable. "+failures);
    }
}
