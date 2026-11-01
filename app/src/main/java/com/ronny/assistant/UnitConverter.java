package com.ronny.assistant;
import java.util.Locale;
/** Local conversion of a deliberately small set of physical units. */
final class UnitConverter {
    private static String normalize(String unit){
        String u=unit.toLowerCase(Locale.ROOT);
        switch(u){
            case "kilometer":case "kilometers":case "kilometre":case "kilometres":return "km";
            case "meter":case "meters":case "metre":case "metres":return "m";
            case "centimeter":case "centimeters":case "centimetre":case "centimetres":return "cm";
            case "mile":case "miles":return "mi";case "foot":case "feet":return "ft";case "inch":case "inches":return "in";
            case "kilogram":case "kilograms":return "kg";case "gram":case "grams":return "g";case "pound":case "pounds":case "lbs":return "lb";
            case "celsius":return "c";case "fahrenheit":return "f";case "kelvin":return "k";
            default:return u;
        }
    }
    private static String group(String u){switch(u){case "km":case "m":case "cm":case "mi":case "ft":case "in":return "length";case "kg":case "g":case "lb":return "mass";case "c":case "f":case "k":return "temperature";default:throw new IllegalArgumentException("Unsupported unit: "+u);}}
    private static double factor(String u){switch(u){case "km":return 1000;case "m":return 1;case "cm":return .01;case "mi":return 1609.344;case "ft":return .3048;case "in":return .0254;case "kg":return 1;case "g":return .001;case "lb":return .45359237;default:throw new IllegalArgumentException("Unsupported unit");}}
    static double convert(double value,String from,String to){
        if(Double.isNaN(value)||Double.isInfinite(value))throw new IllegalArgumentException("Invalid value");
        String a=normalize(from),b=normalize(to),category=group(a);if(!category.equals(group(b)))throw new IllegalArgumentException("Units measure different things");
        double result;
        if(category.equals("temperature")){
            double c=a.equals("c")?value:a.equals("f")?(value-32)*5/9:value-273.15;
            if(c < -273.15-1e-9)throw new IllegalArgumentException("Temperature is below absolute zero");
            result=b.equals("c")?c:b.equals("f")?c*9/5+32:c+273.15;
        }else result=value*factor(a)/factor(b);
        if(Double.isNaN(result)||Double.isInfinite(result))throw new IllegalArgumentException("Result is not finite");return result;
    }
}
