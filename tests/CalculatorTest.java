package com.ronny.assistant;
public final class CalculatorTest {
    private static void expect(String expression,double expected){double actual=Calculator.evaluate(expression);if(Math.abs(actual-expected)>1e-9)throw new AssertionError(expression+" = "+actual);}
    private static void invalid(String expression){try{Calculator.evaluate(expression);throw new AssertionError("Accepted: "+expression);}catch(IllegalArgumentException expected){}}
    public static void main(String[] args){
        expect("2 + 3 * 4",14);expect("(2+3)*4",20);expect("2^3^2",512);expect("-2^2",-4);expect("2^-2",.25);
        expect("20% of 80",16);expect("sqrt(9)+abs(-2)",5);expect("sin(pi/2)",1);expect("log(100)",2);expect("10 ÷ 2",5);
        invalid("1/0");invalid("sqrt(-1)");invalid("2 +");invalid("evil(3)");invalid("1.2.3");invalid("(2+3");invalid("9^9999");
        invalid("-------------------------------------------------------------------------------------------------------------------------------------------------------------------2");
        System.out.println("Calculator: 18 cases passed");
    }
}
