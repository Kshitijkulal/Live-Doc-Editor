export const validate = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// flatten zod's nested error format into something the frontend can actually use
const formatZodErrors = (error) => {
  const formatted = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";

    if (!formatted[path]) {
      formatted[path] = [];
    }

    formatted[path].push(issue.message);
  }

  return formatted;
};