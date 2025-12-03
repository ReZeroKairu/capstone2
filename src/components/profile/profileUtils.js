/**
 * Validates the profile data based on user role
 * @param {Object} profile - The profile data to validate
 * @returns {Object} Validation result with status and missing fields
 */
export const validateProfile = (profile) => {
  // Basic required fields for all users
  const requiredFields = ["firstName", "lastName", "email", "phone"];

  // Role-specific required fields
  if (profile.role === "Researcher") {
    requiredFields.push(
      "university",
      "researchInterests",
      "cvUrl",
      "educations"
    );
  } else if (profile.role === "Peer Reviewer") {
    requiredFields.push("affiliation", "educations", "expertise", "cvUrl");
  }

  const missingFields = [];

  // Check each required field
  for (const field of requiredFields) {
    const value = profile[field];
    let isValid = false;

    // Special handling for expertise field which can be array or string
    if (field === "expertise") {
      if (Array.isArray(value)) {
        // Check if array has at least one non-empty string
        isValid =
          value.length > 0 &&
          value.some(
            (item) =>
              item &&
              (typeof item === "string" ||
                (typeof item === "object" && item !== null)) &&
              String(item).trim() !== ""
          );
      } else if (value && typeof value === "object" && value !== null) {
        // Handle case where expertise is an object (e.g., from a select component)
        const values = Object.values(value).filter(
          (v) => v && String(v).trim() !== ""
        );
        isValid = values.length > 0;
      } else if (typeof value === "string") {
        // Convert string to array and validate
        const expertiseArray = value
          .split(",")
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
        isValid = expertiseArray.length > 0;
      } else {
        // Handle case where value is null, undefined, or other types
        isValid = false;
      }
    }
    // Special handling for cvUrl - check if it exists and is a non-empty string
    else if (field === "cvUrl") {
      isValid = !!value && typeof value === "string" && value.trim() !== "";
    }
    // Standard string field check
    else {
      isValid =
        value && (typeof value === "string" ? value.trim() !== "" : true);
    }

    if (!isValid) {
      // Convert field name to a more readable format
      const fieldName =
        field === "affiliation"
          ? "Institutional affiliation"
          : field === "expertise"
          ? "Area of expertise"
          : field === "cvUrl"
          ? "CV upload"
          : field === "educations"
          ? "Education"
          : field;
      missingFields.push(fieldName);
    }
  }

  // Special handling for educations array for both Researchers and Peer Reviewers
  let hasValidEducation = false;

  if (profile.educations) {
    // Handle case where educations is a string (legacy support)
    if (
      typeof profile.educations === "string" &&
      profile.educations.trim() !== ""
    ) {
      hasValidEducation = true;
    }
    // Handle array of strings or objects
    else if (Array.isArray(profile.educations)) {
      hasValidEducation = profile.educations.some((edu) => {
        if (!edu) return false;
        // Handle both object with school property or direct string value
        return typeof edu === "string"
          ? edu.trim() !== ""
          : edu.school && edu.school.trim() !== "";
      });
    }
  }

  if (!hasValidEducation) {
    const educationFieldName =
      profile.role === "Peer Reviewer" ? "Education details" : "Education";
    missingFields.push(educationFieldName);
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
};
/**
 * Gets a detailed message about missing profile requirements
 * @param {Object} profile - The profile data to check
 * @returns {Object} Object with completion status and message
 */ export const getProfileCompletionStatus = (profile) => {
  if (!profile) {
    return {
      complete: false,
      message: "No profile data available",
      missingFields: [],
    };
  }

  const missingFields = [];

  // Basic info
  if (!profile.firstName?.trim?.()) {
    missingFields.push("First name");
  }
  if (!profile.lastName?.trim?.()) {
    missingFields.push("Last name");
  }
  if (!profile.email?.trim?.()) {
    missingFields.push("Email address");
  }
  if (!profile.phone?.trim?.()) {
    missingFields.push("Phone number");
  }

  // Role-specific fields
  if (profile.role === "Researcher") {
    if (!profile.university?.trim?.()) {
      missingFields.push("University");
    }
    if (!profile.researchInterests?.trim?.()) {
      missingFields.push("Research interests");
    }
    if (!profile.cvUrl) {
      missingFields.push("CV upload");
    }
  } else if (profile.role === "Peer Reviewer") {
    if (!profile.affiliation?.trim?.()) {
      missingFields.push("Institutional affiliation");
    }
    if (!profile.expertise?.length) {
      missingFields.push("Area of expertise");
    } else if (
      Array.isArray(profile.expertise) &&
      !profile.expertise.some((e) => e && e.trim() !== "")
    ) {
      missingFields.push("Area of expertise");
    }
    if (!profile.cvUrl) {
      missingFields.push("CV upload");
    }
  }

  // Education validation for both roles
  const hasValidEducation = (() => {
    // Handle case where educations is not defined or null
    if (!profile.educations) return false;

    // Handle case where educations is a string (legacy support)
    if (typeof profile.educations === "string") {
      return profile.educations.trim() !== "";
    }

    // Handle case where educations is an array
    if (Array.isArray(profile.educations)) {
      return (
        profile.educations.length > 0 &&
        profile.educations.some((edu) => {
          if (!edu) return false;
          // For string entries
          if (typeof edu === "string") return edu.trim() !== "";
          // For object entries
          if (typeof edu === "object") {
            return edu.school?.trim() && edu.degree?.trim() && edu.year;
          }
          return false;
        })
      );
    }

    return false;
  })();

  if (!hasValidEducation) {
    missingFields.push("Education details");
  }

  return {
    complete: missingFields.length === 0,
    message:
      missingFields.length > 0
        ? `Please complete the following: ${missingFields.join(", ")}`
        : "Your profile is complete!",
    missingFields,
  };
};

/**
 * Checks if the profile is complete based on required fields
 * @param {Object} profile - The profile data to check
 * @returns {{complete: boolean, message: string, missingFields: string[]}} Object with completion status and details
 */
export const checkProfileComplete = (profile) => {
  if (!profile) {
    return {
      complete: false,
      message: "No profile data available",
      missingFields: [],
    };
  }

  // For researchers
  if (profile.role === "Researcher") {
    const missingFields = [];

    // Check basic required fields
    if (!profile.firstName?.trim()) missingFields.push("First Name");
    if (!profile.lastName?.trim()) missingFields.push("Last Name");
    if (!profile.email?.trim()) missingFields.push("Email");
    if (!profile.phone?.trim()) missingFields.push("Phone Number");

    // Check researcher-specific fields
    if (!profile.university?.trim()) missingFields.push("University");
    if (!profile.researchInterests?.trim())
      missingFields.push("Research Interests");
    if (!profile.cvUrl) missingFields.push("CV Upload");

    // Check education - accept both formats: array or single string
    let hasValidEducation = false;

    if (Array.isArray(profile.educations)) {
      hasValidEducation =
        profile.educations.length > 0 &&
        profile.educations.some(
          (edu) =>
            edu &&
            ((typeof edu === "string" && edu.trim()) ||
              (typeof edu === "object" && edu.school?.trim()))
        );
    } else if (
      typeof profile.educations === "string" &&
      profile.educations.trim()
    ) {
      hasValidEducation = true;
    } else if (profile.education?.trim?.()) {
      // Fallback to education field if educations is empty
      hasValidEducation = true;
    }

    if (!hasValidEducation) {
      missingFields.push("Education");
    }

    const isComplete = missingFields.length === 0;
    return {
      complete: isComplete,
      message: isComplete
        ? "Profile is complete"
        : `Please complete the following: ${missingFields.join(", ")}`,
      missingFields,
    };
  }
  // For peer reviewers
  else if (profile.role === "Peer Reviewer") {
    const missingFields = [];

    // Check basic required fields
    if (!profile.firstName?.trim()) missingFields.push("First Name");
    if (!profile.lastName?.trim()) missingFields.push("Last Name");
    if (!profile.email?.trim()) missingFields.push("Email");
    if (!profile.phone?.trim()) missingFields.push("Phone Number");

    // Check peer reviewer-specific fields
    if (!profile.affiliation?.trim())
      missingFields.push("Institutional Affiliation");
    if (!profile.cvUrl) missingFields.push("CV Upload");

    // Check expertise - handle both array and string formats
    let hasValidExpertise = false;

    if (Array.isArray(profile.expertise)) {
      hasValidExpertise =
        profile.expertise.length > 0 &&
        profile.expertise.some(
          (e) =>
            (typeof e === "string" && e.trim()) ||
            (typeof e === "object" && Object.values(e).some((v) => v?.trim?.()))
        );
    } else if (
      typeof profile.expertise === "string" &&
      profile.expertise.trim()
    ) {
      hasValidExpertise = true;
    }

    if (!hasValidExpertise) {
      missingFields.push("Area of Expertise");
    }

    // Check education - accept both formats: array or single string
    let hasValidEducation = false;

    if (Array.isArray(profile.educations)) {
      hasValidEducation =
        profile.educations.length > 0 &&
        profile.educations.some(
          (edu) =>
            edu &&
            ((typeof edu === "string" && edu.trim()) ||
              (typeof edu === "object" && edu.school?.trim()))
        );
    } else if (
      typeof profile.educations === "string" &&
      profile.educations.trim()
    ) {
      hasValidEducation = true;
    } else if (profile.education?.trim?.()) {
      // Fallback to education field if educations is empty
      hasValidEducation = true;
    }

    if (!hasValidEducation) {
      missingFields.push("Education");
    }

    const isComplete = missingFields.length === 0;

    return {
      complete: isComplete,
      message: isComplete
        ? "Profile is complete"
        : `Please complete the following: ${missingFields.join(", ")}`,
      missingFields,
    };
  }

  // Default case for other roles (Admin, etc.)
  return {
    complete: true,
    message: "Profile is complete",
    missingFields: [],
  };
};

/**
 * Smooth scroll to a DOM element with an offset
 * @param {HTMLElement} element - The target element to scroll to
 * @param {number} offset - Pixels to offset from the top of the element
 * @param {number} duration - Duration of the scroll animation in ms
 */
export const smoothScrollTo = (element, offset = 0, duration = 300) => {
  if (!element) return;

  const start = window.scrollY;
  const target =
    element.getBoundingClientRect().top + window.pageYOffset - offset;
  const change = target - start;
  const startTime = performance.now();

  const easeInOut = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const scroll = (currentTime) => {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    const easedProgress = easeInOut(progress);
    const scrollAmount = start + change * easedProgress;

    window.scrollTo(0, scrollAmount);

    if (elapsedTime < duration) {
      requestAnimationFrame(scroll);
    }
  };

  requestAnimationFrame(scroll);
};

/**
 * Converts a file to base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<string>} A promise that resolves to the base64 string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Capitalizes the first letter of each word in a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
export const capitalizeWords = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Gets the user's initials from their name
 * @param {string} firstName - User's first name
 * @param {string} middleName - User's middle name (optional)
 * @param {string} lastName - User's last name
 * @returns {string} The user's initials
 */
export const getInitials = (firstName, middleName, lastName) => {
  return (
    (firstName?.[0] || "") +
    (middleName?.[0] || "") +
    (lastName?.[0] || "")
  ).toUpperCase();
};
