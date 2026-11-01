package com.ronny.assistant;

import java.util.Locale;

/** Bounded arithmetic parser. It never evaluates code or accesses device data. */
final class Calculator {
    private final String text;
    private int position, depth;
    private Calculator(String input) { text=input.toLowerCase(Locale.ROOT).replace('×','*').replace('÷','/').replaceAll("\\s+of\\s+", "*"); }
    static double evaluate(String input) {
        if(input==null || input.trim().isEmpty() || input.length()>256) throw new IllegalArgumentException("Expression is empty or too long");
        Calculator c=new Calculator(input);double result=c.expression();c.space();
        if(c.position!=c.text.length())throw new IllegalArgumentException("Unexpected character at position "+(c.position+1));
        return finite(result);
    }
    private static double finite(double value){if(Double.isNaN(value)||Double.isInfinite(value))throw new IllegalArgumentException("Result is not finite");return value;}
    private void space(){while(position<text.length()&&Character.isWhitespace(text.charAt(position)))position++;}
    private boolean eat(char ch){space();if(position<text.length()&&text.charAt(position)==ch){position++;return true;}return false;}
    private double expression(){double x=term();for(;;){if(eat('+'))x=finite(x+term());else if(eat('-'))x=finite(x-term());else return x;}}
    private double term(){double x=unary();for(;;){if(eat('*'))x=finite(x*unary());else if(eat('/')){double y=unary();if(y==0)throw new IllegalArgumentException("Cannot divide by zero");x=finite(x/y);}else return x;}}
    private double unary(){
        if(++depth>64)throw new IllegalArgumentException("Expression is too deeply nested");
        try{if(eat('+'))return unary();if(eat('-'))return finite(-unary());double x=postfix();if(eat('^'))x=finite(Math.pow(x,unary()));return x;}finally{depth--;}
    }
    private double postfix(){double x=primary();while(eat('%'))x/=100;return x;}
    private double primary(){
        space();
        if(eat('(')){double x=expression();if(!eat(')'))throw new IllegalArgumentException("Missing closing parenthesis");return x;}
        if(position<text.length()&&(Character.isDigit(text.charAt(position))||text.charAt(position)=='.')){
            int start=position;while(position<text.length()&&(Character.isDigit(text.charAt(position))||text.charAt(position)=='.'))position++;
            try{return finite(Double.parseDouble(text.substring(start,position)));}catch(NumberFormatException e){throw new IllegalArgumentException("Invalid number");}
        }
        int start=position;while(position<text.length()&&Character.isLetter(text.charAt(position)))position++;
        if(start==position)throw new IllegalArgumentException("Expected a number");
        String name=text.substring(start,position);
        if(name.equals("pi"))return Math.PI;if(name.equals("e"))return Math.E;
        if(!eat('('))throw new IllegalArgumentException("Function needs parentheses");
        double x=expression();if(!eat(')'))throw new IllegalArgumentException("Missing closing parenthesis");
        switch(name){
            case "sqrt":return finite(Math.sqrt(x));case "sin":return finite(Math.sin(x));case "cos":return finite(Math.cos(x));case "tan":return finite(Math.tan(x));
            case "log":return finite(Math.log10(x));case "ln":return finite(Math.log(x));case "abs":return finite(Math.abs(x));
            default:throw new IllegalArgumentException("Unknown function: "+name);
        }
    }
}
