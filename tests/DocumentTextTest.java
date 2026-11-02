package com.ronny.assistant;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
public final class DocumentTextTest {
    private static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
    private static String read(String s)throws Exception{return DocumentText.read(new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8)));}
    private static void invalid(byte[] b){try{DocumentText.read(new ByteArrayInputStream(b));throw new AssertionError("Invalid file accepted");}catch(IOException expected){}}
    public static void main(String[] args)throws Exception{
        check(read("Hello नमस्ते").equals("Hello नमस्ते"),"UTF-8");
        check(read("\ufeffhello").equals("hello"),"BOM");
        invalid(new byte[]{(byte)0xc3,(byte)0x28});invalid(new byte[]{'a',0,'b'});invalid(new byte[0]);invalid("  \n".getBytes(StandardCharsets.UTF_8));
        byte[] exact=new byte[DocumentText.MAX_BYTES];Arrays.fill(exact,(byte)'a');check(DocumentText.read(new ByteArrayInputStream(exact)).length()==exact.length,"exact limit");
        byte[] tooLong=new byte[DocumentText.MAX_BYTES+1];Arrays.fill(tooLong,(byte)'a');invalid(tooLong);
        check(DocumentText.excerpt("A😀B",2).equals("A"),"surrogate boundary");
        check(DocumentText.excerpt("A😀B",3).equals("A😀"),"complete surrogate");
        check(DocumentText.excerpt("short",100).equals("short"),"short excerpt");
        try{DocumentText.excerpt("a",-1);throw new AssertionError("negative limit");}catch(IllegalArgumentException expected){}
        System.out.println("DocumentText: 12 cases passed");
    }
}
