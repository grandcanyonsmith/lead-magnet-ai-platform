/**
 * Form utility functions
 */

import React from "react";
import { FiMail, FiPhone, FiHash, FiList, FiType } from "react-icons/fi";

export function getFieldTypeIcon(fieldType: string) {
  switch (fieldType) {
    case "email":
      return <FiMail className="w-4 h-4" />;
    case "tel":
      return <FiPhone className="w-4 h-4" />;
    case "number":
      return <FiHash className="w-4 h-4" />;
    case "select":
      return <FiList className="w-4 h-4" />;
    case "textarea":
      return <FiType className="w-4 h-4" />;
    default:
      return <FiType className="w-4 h-4" />;
  }
}
