function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

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

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { message: "Method not allowed." });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return sendJson(response, 200, {
      configured: false,
      message: "Google reviews are not configured yet.",
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
