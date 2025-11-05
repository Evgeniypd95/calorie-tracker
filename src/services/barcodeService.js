/**
 * Barcode Food Database Service
 *
 * This service queries multiple FREE food databases to fetch nutritional information
 * based on product barcodes (UPC/EAN codes).
 *
 * ALL databases are completely free with no API keys required!
 *
 * Supported databases:
 * 1. Open Food Facts (International) - 2M+ products worldwide, truly free
 * 2. Open Food Facts (US specific) - US product database
 * 3. Open Food Facts (UK specific) - UK product database
 * 4. Open Food Facts (FR specific) - French product database
 * 5. FatSecret Platform API - Optional free tier (requires API key)
 * 6. Edamam Food Database - Optional free tier (requires API key)
 */

// Configuration for optional API keys (add these to your .env file)
const FATSECRET_CLIENT_ID = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID || '';
const FATSECRET_CLIENT_SECRET = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET || '';
const EDAMAM_APP_ID = process.env.EXPO_PUBLIC_EDAMAM_APP_ID || '';
const EDAMAM_APP_KEY = process.env.EXPO_PUBLIC_EDAMAM_APP_KEY || '';

/**
 * Query Open Food Facts database
 * Free, no API key required, comprehensive international database
 */
async function queryOpenFoodFacts(barcode) {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const product = data.product;
      const nutriments = product.nutriments || {};

      return {
        source: 'Open Food Facts',
        found: true,
        product: {
          name: product.product_name || product.product_name_en || 'Unknown Product',
          brand: product.brands || '',
          quantity: product.quantity || '',
          servingSize: product.serving_size || '',
          nutritionPer100g: {
            calories: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0,
            protein: nutriments.proteins_100g || nutriments.proteins || 0,
            carbs: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
            fat: nutriments.fat_100g || nutriments.fat || 0,
            fiber: nutriments.fiber_100g || nutriments.fiber || 0,
            sugar: nutriments.sugars_100g || nutriments.sugars || 0,
            sodium: nutriments.sodium_100g || nutriments.sodium || 0,
          },
          nutritionPerServing: product.serving_size ? {
            calories: nutriments['energy-kcal_serving'] || 0,
            protein: nutriments.proteins_serving || 0,
            carbs: nutriments.carbohydrates_serving || 0,
            fat: nutriments.fat_serving || 0,
          } : null,
          imageUrl: product.image_url || product.image_front_url || '',
          ingredients: product.ingredients_text || '',
          barcode: barcode
        }
      };
    }

    return { source: 'Open Food Facts', found: false };
  } catch (error) {
    console.error('Open Food Facts API error:', error);
    return { source: 'Open Food Facts', found: false, error: error.message };
  }
}

/**
 * Query Open Food Facts with country-specific domains
 * Tries different regional databases for better coverage
 */
async function queryOpenFoodFactsRegional(barcode, country = 'us') {
  const domains = {
    us: 'us.openfoodfacts.org',
    uk: 'uk.openfoodfacts.org',
    fr: 'fr.openfoodfacts.org',
    de: 'de.openfoodfacts.org',
    es: 'es.openfoodfacts.org',
    it: 'it.openfoodfacts.org'
  };

  const domain = domains[country] || domains.us;

  try {
    const response = await fetch(
      `https://${domain}/api/v0/product/${barcode}.json`
    );
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const product = data.product;
      const nutriments = product.nutriments || {};

      return {
        source: `Open Food Facts (${country.toUpperCase()})`,
        found: true,
        product: {
          name: product.product_name || product.product_name_en || 'Unknown Product',
          brand: product.brands || '',
          quantity: product.quantity || '',
          servingSize: product.serving_size || '100g',
          nutritionPer100g: {
            calories: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0,
            protein: nutriments.proteins_100g || nutriments.proteins || 0,
            carbs: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
            fat: nutriments.fat_100g || nutriments.fat || 0,
            fiber: nutriments.fiber_100g || nutriments.fiber || 0,
            sugar: nutriments.sugars_100g || nutriments.sugars || 0,
            sodium: nutriments.sodium_100g || nutriments.sodium || 0,
          },
          nutritionPerServing: product.serving_size ? {
            calories: nutriments['energy-kcal_serving'] || 0,
            protein: nutriments.proteins_serving || 0,
            carbs: nutriments.carbohydrates_serving || 0,
            fat: nutriments.fat_serving || 0,
          } : null,
          imageUrl: product.image_url || product.image_front_url || '',
          ingredients: product.ingredients_text || '',
          barcode: barcode
        }
      };
    }

    return { source: `Open Food Facts (${country.toUpperCase()})`, found: false };
  } catch (error) {
    console.error(`Open Food Facts ${country} API error:`, error);
    return { source: `Open Food Facts (${country.toUpperCase()})`, found: false, error: error.message };
  }
}

/**
 * Query FatSecret Platform API
 * Free tier available: https://platform.fatsecret.com/api/
 * Requires OAuth 2.0 authentication
 */
async function queryFatSecret(barcode) {
  if (!FATSECRET_CLIENT_ID || !FATSECRET_CLIENT_SECRET) {
    return { source: 'FatSecret', found: false, error: 'API key not configured' };
  }

  try {
    // Get OAuth token
    // Use btoa for base64 encoding (works in React Native and browsers)
    const authString = btoa(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`);
    const tokenResponse = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=barcode'
    });

    if (!tokenResponse.ok) {
      return { source: 'FatSecret', found: false, error: 'Authentication failed' };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Search by barcode
    const searchResponse = await fetch(
      `https://platform.fatsecret.com/rest/server.api?method=food.find_id_for_barcode&barcode=${barcode}&format=json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const searchData = await searchResponse.json();

    if (searchData.food_id && searchData.food_id.value) {
      // Get detailed food info
      const foodResponse = await fetch(
        `https://platform.fatsecret.com/rest/server.api?method=food.get.v2&food_id=${searchData.food_id.value}&format=json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const foodData = await foodResponse.json();

      if (foodData.food) {
        const food = foodData.food;
        const serving = food.servings?.serving?.[0] || {};

        return {
          source: 'FatSecret',
          found: true,
          product: {
            name: food.food_name || 'Unknown Product',
            brand: food.brand_name || '',
            servingSize: serving.serving_description || '100g',
            nutritionPerServing: {
              calories: parseFloat(serving.calories || 0),
              protein: parseFloat(serving.protein || 0),
              carbs: parseFloat(serving.carbohydrate || 0),
              fat: parseFloat(serving.fat || 0),
              fiber: parseFloat(serving.fiber || 0),
              sugar: parseFloat(serving.sugar || 0),
            },
            barcode: barcode
          }
        };
      }
    }

    return { source: 'FatSecret', found: false };
  } catch (error) {
    console.error('FatSecret API error:', error);
    return { source: 'FatSecret', found: false, error: error.message };
  }
}

/**
 * Query Edamam Food Database API
 * Free tier: https://developer.edamam.com/food-database-api
 * 10,000 calls/month free
 */
async function queryEdamam(barcode) {
  if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY) {
    return { source: 'Edamam', found: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://api.edamam.com/api/food-database/v2/parser?upc=${barcode}&app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}`
    );

    const data = await response.json();

    if (data.hints && data.hints.length > 0) {
      const food = data.hints[0].food;
      const nutrients = food.nutrients || {};

      return {
        source: 'Edamam',
        found: true,
        product: {
          name: food.label || 'Unknown Product',
          brand: food.brand || '',
          servingSize: '100g',
          nutritionPer100g: {
            calories: nutrients.ENERC_KCAL || 0,
            protein: nutrients.PROCNT || 0,
            carbs: nutrients.CHOCDF || 0,
            fat: nutrients.FAT || 0,
            fiber: nutrients.FIBTG || 0,
            sugar: nutrients.SUGAR || 0,
          },
          imageUrl: food.image || '',
          barcode: barcode
        }
      };
    }

    return { source: 'Edamam', found: false };
  } catch (error) {
    console.error('Edamam API error:', error);
    return { source: 'Edamam', found: false, error: error.message };
  }
}

/**
 * Look up product by barcode from multiple databases
 * Tries databases in order until one returns results
 * Priority: Free databases first, then optional paid/limited ones
 */
export async function lookupBarcode(barcode) {
  console.log('Looking up barcode:', barcode);

  // Try Open Food Facts International first (completely free, no API key needed)
  const offResult = await queryOpenFoodFacts(barcode);
  if (offResult.found) {
    return offResult;
  }

  // Try regional Open Food Facts databases (also free)
  const regions = ['us', 'uk', 'fr', 'de', 'es', 'it'];
  for (const region of regions) {
    const regionalResult = await queryOpenFoodFactsRegional(barcode, region);
    if (regionalResult.found) {
      return regionalResult;
    }
  }

  // Try FatSecret if API key is configured (optional, free tier)
  if (FATSECRET_CLIENT_ID && FATSECRET_CLIENT_SECRET) {
    const fatSecretResult = await queryFatSecret(barcode);
    if (fatSecretResult.found) {
      return fatSecretResult;
    }
  }

  // Try Edamam if API key is configured (optional, 10k calls/month free)
  if (EDAMAM_APP_ID && EDAMAM_APP_KEY) {
    const edamamResult = await queryEdamam(barcode);
    if (edamamResult.found) {
      return edamamResult;
    }
  }

  // No results found in any database
  return {
    found: false,
    message: 'Product not found in any database. Try scanning again or enter manually.',
    barcode: barcode
  };
}

/**
 * Convert barcode product data to meal description format
 * This formats the product info so it can be parsed by the AI
 */
export function formatBarcodeProductForParsing(productResult) {
  if (!productResult.found || !productResult.product) {
    return null;
  }

  const product = productResult.product;
  const name = product.name;
  const brand = product.brand ? ` (${product.brand})` : '';
  const serving = product.servingSize || product.quantity || '100g';

  // Create a description that includes the nutritional info
  return {
    description: `${name}${brand}, ${serving}`,
    nutritionData: product.nutritionPerServing || product.nutritionPer100g,
    servingSize: serving,
    source: productResult.source,
    imageUrl: product.imageUrl
  };
}

export default {
  lookupBarcode,
  formatBarcodeProductForParsing
};
