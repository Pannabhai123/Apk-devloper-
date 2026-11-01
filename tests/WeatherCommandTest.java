package com.ronny.assistant;
public final class WeatherCommandTest {
    private static void is(String input,String expected){String actual=WeatherCommand.city(input);if(expected==null?actual!=null:!expected.equals(actual))throw new AssertionError(input+" -> "+actual);}
    public static void main(String[] args){
        is("weather in Bhagalpur","Bhagalpur");is("Ronny, weather in New Delhi?","New Delhi");is("hey ronny aaj ka mausam in Pune", "Pune");
        is("मौसम में पटना", "पटना");is("weather",null);is("weather in ",null);is("what is weather in Delhi",null);
        System.out.println("WeatherCommand: 7 cases passed");
    }
}
