/**
 * Validates the profile data based on user role
 * @param {Object} profile - The profile data to validate
 * @returns {Object} Validation result with status and missing fields
 */
export const validateProfile = (profile) => {
  // Basic required fields for all users
  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "department",
  ];

  // Role-specific required fields
  if (profile.role === "Researcher") {
    requiredFields.push("institution", "fieldOfStudy", "researchInterests");
  } else if (profile.role === "Peer Reviewer") {
    requiredFields.push(
      "affiliation",
      "expertise",
      "education",
      "cvUrl" // CV is required for peer reviewers
    );
  }

  const missingFields = requiredFields.filter((field) => {
    const value = profile[field];
    // Check if the value is empty or contains only whitespace
    return !value || (typeof value === "string" && value.trim() === "");
  });

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
};

/**
 * Gets a detailed message about missing profile requirements
 * @param {Object} profile - The profile data to check
 * @returns {Object} Object with completion status and message
 */
export const getProfileCompletionStatus = (profile) => {
  if (!profile) {
    return {
      complete: false,
      message: "No profile data available",
      missingFields: [],
    };
  }

  const missingFields = [];

  // Basic info
  if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
    missingFields.push("Full name");
  }
  if (!profile.email?.trim()) {
    missingFields.push("Email address");
  }
  if (!profile.phone?.trim()) {
    missingFields.push("Phone number");
  }

  // Peer reviewer specific
  if (profile.role === "Peer Reviewer") {
    if (!profile.affiliation?.trim()) {
      missingFields.push("Institutional affiliation");
    }
    if (!profile.expertise?.trim()) {
      missingFields.push("At least one area of expertise");
    }
    if (!profile.education?.trim()) {
      missingFields.push("Education details");
    }
    if (!profile.cvUrl) {
      missingFields.push("CV upload");
    }
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
 * @returns {boolean} True if the profile is complete
 */
export const checkProfileComplete = (profile) => {
  if (!profile) return false;

  const validation = validateProfile(profile);

  // Additional checks beyond basic validation
  if (profile.role === "Researcher") {
    return (
      validation.valid &&
      profile.researchInterests &&
      profile.researchInterests.trim() !== ""
    );
  } else if (profile.role === "Peer Reviewer") {
    // Define all required fields and their human-readable names
    const requiredFields = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phone: "Phone Number",
      affiliation: "Institutional Affiliation",
      education: "Education Details",
      expertise: "Areas of Expertise",
      cvUrl: "CV Upload",
    };

    // Check each required field
    const missingFields = [];
    const fieldStatus = {};

    for (const [field, label] of Object.entries(requiredFields)) {
      let isValid = false;

      if (field === "expertise") {
        // Handle cases where expertise might be a string, array, or undefined
        if (Array.isArray(profile[field])) {
          isValid = profile[field].length > 0;
        } else if (typeof profile[field] === "string") {
          // If it's a string, check if it's not empty
          isValid = profile[field].trim() !== "";
        } else {
          isValid = false;
        }
      } else if (field === "cvUrl") {
        isValid = !!profile[field];
      } else {
        isValid = !!profile[field]?.toString()?.trim();
      }

      fieldStatus[`has${field.charAt(0).toUpperCase() + field.slice(1)}`] =
        isValid;
      if (!isValid) {
        missingFields.push(label);
      }
    }

    const isComplete = missingFields.length === 0;

    if (!isComplete) {
      console.log("Profile incomplete. Missing fields:", fieldStatus);
      console.log("Missing required fields:", missingFields);
    }

    return isComplete;
  }

  return validation.valid;
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
