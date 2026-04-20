import { asyncHandler } from "../utils/expressAsyncHandler.js";
import { sendResponse } from "../utils/apiResponse.js";
import { getDocument } from "../services/document.service.js";

export const fetchDocument = asyncHandler(async (req, res) => {
  const doc = await getDocument();

  return sendResponse(res, {
    message: "Document fetched successfully",
    data: doc,
  });
});