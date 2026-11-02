package com.ronny.assistant;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Limits document memory and only accepts genuine UTF-8 plain text. */
final class DocumentText {
    static final int MAX_BYTES=128*1024;
    static final int MAX_AI_CHARS=12000;
    static String read(InputStream input) throws IOException {
        if(input==null)throw new IOException("Could not open the selected file");
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int size=0;
        for(;;){
            int n=input.read(buffer);
            if(n<0)break;
            if(n==0){int one=input.read();if(one<0)break;buffer[0]=(byte)one;n=1;}
            size+=n;if(size>MAX_BYTES)throw new IOException("File exceeds the 128 KB limit");
            out.write(buffer,0,n);
        }
        final String text;
        try{text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(out.toByteArray())).toString();}
        catch(CharacterCodingException e){throw new IOException("File is not valid UTF-8 text",e);}
        String result=text.startsWith("\ufeff")?text.substring(1):text;
        if(result.indexOf('\0')>=0)throw new IOException("File is not plain text");
        if(result.trim().isEmpty())throw new IOException("File is empty");
        return result;
    }
    static String excerpt(String text,int limit){
        if(limit<0)throw new IllegalArgumentException("Negative limit");
        int end=Math.min(text.length(),limit);
        if(end>0 && end<text.length() && Character.isHighSurrogate(text.charAt(end-1)) && Character.isLowSurrogate(text.charAt(end)))end--;
        return text.substring(0,end);
    }
}
