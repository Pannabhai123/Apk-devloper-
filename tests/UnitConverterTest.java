package com.ronny.assistant;
public final class UnitConverterTest {
    private static void expect(double n,String a,String b,double value){double result=UnitConverter.convert(n,a,b);if(Math.abs(result-value)>1e-8)throw new AssertionError(a+" to "+b+" = "+result);}
    private static void invalid(double n,String a,String b){try{UnitConverter.convert(n,a,b);throw new AssertionError("accepted "+a+" to "+b);}catch(IllegalArgumentException expected){}}
    public static void main(String[] args){expect(1,"km","m",1000);expect(1,"miles","km",1.609344);expect(1,"ft","in",12);expect(1,"kg","g",1000);expect(1,"lb","kg",.45359237);expect(0,"celsius","fahrenheit",32);expect(32,"fahrenheit","celsius",0);expect(0,"celsius","kelvin",273.15);invalid(1,"km","kg");invalid(0,"c","x");invalid(-300,"c","f");System.out.println("UnitConverter: 11 cases passed");}
}
