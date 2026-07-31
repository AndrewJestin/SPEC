function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

const DEFAULT_GOOGLE_PLACE_ID = "ChIJwx48a3XIriYRAnepOkQU1AI";

let cachedPlace = null;

function normalizeReview(review) {
  const attribution = review.authorAttribution || {};
  const text = review.text || {};

  return {
    authorName: attribution.displayName || "Google reviewer",
    authorUri: attribution.uri || "",
    authorPhoto: attribution.photoUri || attribution.photoURI || "",
    rating: review.rating || null,
    text: text.text || "",
    relativeTime: review.relativePublishTimeDescription || "",
    googleMapsUri: review.googleMapsUri || "",
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSpecPlace(place) {
  const name = normalizeText(place.displayName?.text);
  return name.includes("smart property exterior care") || name.includes("spec smart property exterior care");
}

function isValidPlaceId(placeId) {
  return /^ChIJ[A-Za-z0-9_-]+$/.test(String(placeId || "").trim());
}

function formatPlaceResponse(place) {
  return {
    configured: true,
    name: place.displayName?.text || "SPEC Smart Property Exterior Care",
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    googleMapsUri: place.googleMapsUri || "",
    reviews: Array.isArray(place.reviews) ? place.reviews.map(normalizeReview) : [],
  };
}

async function findPlace(apiKey) {
  if (cachedPlace) return cachedPlace;

  const queries = [
    process.env.GOOGLE_PLACE_QUERY,
    "Smart Property Exterior Care Franklin NC",
    "Smart Property Exterior Care",
    "spec-exterior.com",
    "(828) 600-7732",
  ].filter(Boolean);

  for (const textQuery of queries) {
    const searchResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.reviews",
      },
      body: JSON.stringify({ textQuery, maxResultCount: 5 }),
    });

    const data = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error("Google place search failed", {
        status: searchResponse.status,
        query: textQuery,
        body: data,
      });
      continue;
    }

    const places = Array.isArray(data.places) ? data.places : [];
    const match = places.find(isSpecPlace);

    if (match) {
      cachedPlace = match;
      return cachedPlace;
    }
  }

  return null;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { message: "Method not allowed." });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return sendJson(response, 200, {
      configured: false,
      message: "Google reviews are not configured yet.",
      reviews: [],
    });
  }

  const configuredPlaceId = DEFAULT_GOOGLE_PLACE_ID;
  const searchedPlace = configuredPlaceId ? null : await findPlace(apiKey);
  const placeId = configuredPlaceId || searchedPlace?.id;

  if (!placeId && !searchedPlace) {
    return sendJson(response, 200, {
      configured: true,
      message: "Google Business Profile was not found by Places search yet.",
      reviews: [],
    });
  }

  if (!configuredPlaceId && searchedPlace) {
    return sendJson(response, 200, formatPlaceResponse(searchedPlace));
  }

  const fieldMask = [
    "id",
    "displayName",
    "rating",
    "userRatingCount",
    "reviews",
    "googleMapsUri",
  ].join(",");

  const placesResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  const data = await placesResponse.json();

  if (!placesResponse.ok) {
    console.error("Google reviews fetch failed", {
      status: placesResponse.status,
      body: data,
    });

    const fallbackPlace = await findPlace(apiKey);

    if (fallbackPlace) {
      return sendJson(response, 200, formatPlaceResponse(fallbackPlace));
    }

    return sendJson(response, 200, {
      configured: true,
      message: "Google reviews are temporarily unavailable.",
      reviews: [],
    });
  }

  return sendJson(response, 200, {
    ...formatPlaceResponse(data),
  });
};
