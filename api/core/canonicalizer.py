import re

# ---- Multi-word phrases to preserve (expand over time) ----
PHRASE_INGREDIENTS = [
    # spices / blends
    "chinese five spice",
    "five spice",
    "curry powder",
    "chili powder",
    "black pepper",
    "sea salt",

    # oils / condiments
    "extra virgin olive oil",
    "olive oil",
    "sesame oil",
    "sunflower oil",
    "rapeseed oil",
    "groundnut oil",
    "vegetable oil",
    "canola oil",
    "soy sauce",
    "fish sauce",
    "oyster sauce",

    # stocks / broths
    "chicken stock",
    "beef stock",
    "vegetable stock",
    "fish stock",
    "chicken broth",
    "beef broth",
    "vegetable broth",

    # produce / common phrases
    "spring onion",
    "green onion",
    "red onion",
    "white onion",
    "yellow onion",
    "sweet potato",
    "bell pepper",
    "russet potato",
    "cherry tomato",
    "roma tomato",
    "plum tomato",

    # dairy / cheese / plant milk
    "parmesan cheese",
    "cheddar cheese",
    "mozzarella cheese",
    "goat cheese",
    "cream cheese",
    "coconut milk",
    "almond milk",
    "evaporated milk",
    "whole milk",
    "skim milk",
    "low fat milk",
    "heavy cream",
    "double cream",
    "sour cream",
    "whipping cream",

    # proteins / cuts
    "chicken breast",
    "chicken thigh",
    "chicken drumstick",
    "chicken wing",
    "chicken leg",
    "ground beef",
    "ground turkey",
    "ground chicken",
    "ground pork",
    "pork belly",
    "pork chop",
    "pork loin",
    "pork shoulder",
    "beef brisket",
    "beef steak",
    "salmon fillet",
    "cod fillet",

    # flours / grains
    "all purpose flour",
    "plain flour",
    "self raising flour",
    "bread flour",
    "brown rice",
    "white rice",
    "basmati rice",
    "jasmine rice",
    "long grain rice",

    # sugars
    "brown sugar",
    "white sugar",
    "caster sugar",
    "powdered sugar",
    "icing sugar",

    # pastry
    "puff pastry",
    "filo pastry",

    # other compounds
    "cat food",
    "dog food",
    "pop tarts",
    "coca cola",
]

# ---- Alias map (canonical forms) ----
ALIASES = {
    "extra virgin olive oil": "olive oil",
    "vegetable oil": "oil",
    "canola oil": "oil",
    "sunflower oil": "oil",
    "rapeseed oil": "oil",
    "groundnut oil": "oil",

    # plurals
    "eggs": "egg",
    "tomatoes": "tomato",
    "onions": "onion",
    "potatoes": "potato",
    "carrots": "carrot",
    "apples": "apple",
    "lemons": "lemon",
    "limes": "lime",
    "oranges": "orange",
    "bananas": "banana",
    "peppers": "pepper",
    "mushrooms": "mushroom",
    "strawberries": "strawberry",
    "blueberries": "blueberry",
    "raspberries": "raspberry",
    "grapes": "grape",
    "peaches": "peach",
    "pears": "pear",
    "avocados": "avocado",
    "cucumbers": "cucumber",
    "zucchinis": "zucchini",
    "russet potatoes": "potato",

    # compound protein → simple form (so "Chicken Breast" in inventory matches "chicken" in recipes)
    "chicken breast": "chicken",
    "chicken thigh": "chicken",
    "chicken drumstick": "chicken",
    "chicken wing": "chicken",
    "chicken leg": "chicken",
    "pork belly": "pork",
    "pork chop": "pork",
    "pork loin": "pork",
    "pork shoulder": "pork",
    "beef brisket": "beef",
    "beef steak": "beef",
    "ground beef": "beef",
    "ground turkey": "turkey",
    "ground chicken": "chicken",
    "ground pork": "pork",
    "salmon fillet": "salmon",
    "cod fillet": "cod",

    # compound dairy → simple form
    "whole milk": "milk",
    "skim milk": "milk",
    "low fat milk": "milk",
    "heavy cream": "cream",
    "double cream": "cream",
    "sour cream": "cream",
    "whipping cream": "cream",
    "cheddar cheese": "cheese",
    "parmesan cheese": "parmesan",
    "cream cheese": "cream cheese",
    "mozzarella cheese": "mozzarella",
    "goat cheese": "cheese",

    # IMPORTANT: keep coconut milk and almond milk distinct from milk
    "coconut milk": "coconut milk",
    "almond milk": "almond milk",

    # produce compounds
    "sweet potato": "sweet potato",
    "bell pepper": "pepper",
    "red onion": "onion",
    "white onion": "onion",
    "yellow onion": "onion",
    "green onion": "spring onion",
    "cherry tomato": "tomato",
    "roma tomato": "tomato",
    "plum tomato": "tomato",

    # normalize stocks
    "chicken stock": "stock",
    "beef stock": "stock",
    "vegetable stock": "stock",
    "fish stock": "stock",
    "chicken broth": "stock",
    "beef broth": "stock",
    "vegetable broth": "stock",

    # parts of ingredient
    "yolk": "egg",
    "egg yolk": "egg",
    "egg white": "egg",

    # normalize spice blends
    "chinese five spice": "five spice",

    # non-food products → map to something that won't match recipes
    "cat food": "_non_food",
    "dog food": "_non_food",
    "pop tarts": "_non_food",
    "coca cola": "_non_food",

    # pasta types
    "lasagne": "pasta",
    "lasagna": "pasta",
    "spaghetti": "pasta",
    "penne": "pasta",
    "fettuccine": "pasta",
    "rigatoni": "pasta",
    "macaroni": "pasta",
    "linguine": "pasta",
    "tagliatelle": "pasta",
    "fusilli": "pasta",

    # common pantry aliases
    "all purpose flour": "flour",
    "plain flour": "flour",
    "self raising flour": "flour",
    "bread flour": "flour",
    "brown sugar": "sugar",
    "white sugar": "sugar",
    "caster sugar": "sugar",
    "powdered sugar": "sugar",
    "icing sugar": "sugar",
    "brown rice": "rice",
    "white rice": "rice",
    "basmati rice": "rice",
    "jasmine rice": "rice",
    "long grain rice": "rice",
}

# tokens that are usually not meaningful alone in this dataset
# Includes: descriptors, preparation methods, brand fragments, sizes, etc.
DROP_TOKENS = {
    # original
    "five", "chinese",
    "t", "reduced", "eating", "single", "back", "flower",
    "fresh", "large", "small",

    # sizes / quantities
    "medium", "extra", "mini", "jumbo", "giant", "regular",
    "thin", "thick", "whole", "half",

    # preparation / state descriptors
    "shredded", "breaded", "purified", "sliced", "diced", "chopped",
    "minced", "crushed", "grated", "peeled", "toasted", "roasted",
    "grilled", "baked", "fried", "steamed", "boiled", "smoked",
    "cured", "dried", "frozen", "canned", "packed", "stuffed",
    "marinated", "seasoned", "cooked", "raw", "uncooked",
    "boneless", "skinless", "seedless", "pitted",
    "unsalted", "salted", "sweetened", "unsweetened",

    # quality / type descriptors
    "organic", "natural", "premium", "select", "choice", "prime",
    "classic", "original", "traditional", "homestyle", "artisan",
    "imported", "domestic", "local",
    "low", "less", "free", "lite", "light", "fat", "lean",
    "calorie", "calories",
    "plain", "greek", "italian", "french", "mexican", "japanese",
    "american", "british", "thai", "indian", "korean", "spanish",

    # packaging / product descriptors
    "brand", "pack", "count", "oz", "lb", "kg", "ml", "ct",
    "bag", "box", "can", "jar", "bottle", "carton", "tub",
    "pouch", "wrapper", "container",
    "one", "two", "three", "four", "six", "eight", "twelve",
    "dry", "wet", "liquid",

    # non-food noise
    "food", "foods", "pet", "cat", "dog", "treat", "treats",
    "toaster", "snack", "snacks",
    "drink", "drinks", "beverage", "beverages",
    "purified", "distilled", "spring", "sparkling", "carbonated",
    "grocer", "grocery", "market", "store",
}


def canonicalize_text(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def stable_dedupe(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            out.append(x)
            seen.add(x)
    return out


def parse_ingredients(text: str):
    """
    Phrase-aware parsing of ingredient string.
    Returns list of canonical ingredient tokens (stable order).
    """
    text = canonicalize_text(text)
    found = []

    # Longest phrases first (important!)
    for phrase in sorted(PHRASE_INGREDIENTS, key=len, reverse=True):
        if phrase in text:
            found.append(phrase)
            text = text.replace(phrase, " ")

    tokens = [t for t in text.split() if t and t not in DROP_TOKENS]

    all_items = found + tokens

    # Apply alias map after phrase extraction
    normalized = [ALIASES.get(item, item) for item in all_items]

    # Stable dedupe
    return stable_dedupe(normalized)