function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

let cachedPlaceId = "";

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

async function findPlaceId(apiKey) {
  if (cachedPlaceId) return cachedPlaceId;

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
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
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

    if (match?.id) {
      cachedPlaceId = match.id;
      return cachedPlaceId;
    }
  }

  return "";
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

  const placeId = process.env.GOOGLE_PLACE_ID || await findPlaceId(apiKey);

  if (!placeId) {
    return sendJson(response, 200, {
      configured: true,
      message: "Google Business Profile was not found by Places search yet.",
      reviews: [],
    });
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

    return sendJson(response, 200, {
      configured: true,
      message: "Google reviews are temporarily unavailable.",
      reviews: [],
    });
  }

  return sendJson(response, 200, {
    configured: true,
    name: data.displayName?.text || "SPEC Smart Property Exterior Care",
    rating: data.rating || null,
    userRatingCount: data.userRatingCount || 0,
    googleMapsUri: data.googleMapsUri || "",
    reviews: Array.isArray(data.reviews) ? data.reviews.map(normalizeReview) : [],
  });
};
