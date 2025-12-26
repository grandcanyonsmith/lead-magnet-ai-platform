"""
Field Label Service
Handles field label mapping for form submissions.
"""

import logging
from typing import Dict, Any, Optional

from services.context_builder import ContextBuilder

logger = logging.getLogger(__name__)


class FieldLabelService:
    """Service for managing field label mappings."""
    
    @staticmethod
    def build_field_label_map(form: Optional[Dict[str, Any]]) -> Dict[str, str]:
        """
        Build field ID to label mapping from form schema.
        
        Args:
            form: Form dictionary containing form_fields_schema
            
        Returns:
            Dictionary mapping field_id to label
        """
        field_label_map = {}
        if form and form.get('form_fields_schema') and form['form_fields_schema'].get('fields'):
            for field in form['form_fields_schema']['fields']:
                field_id = field.get('field_id')
                label = field.get('label', field_id)
                field_label_map[field_id] = label
        
        return field_label_map
    
    @staticmethod
    def format_submission_data_with_labels(
        data: Dict[str, Any],
        field_label_map: Dict[str, str]
    ) -> str:
        """
        Format submission data using field labels instead of field IDs.
        
        Args:
            data: Submission data dictionary
            field_label_map: Map of field IDs to labels
            
        Returns:
            Formatted string with labels
        """
        return ContextBuilder.format_submission_data_with_labels(data, field_label_map)

    @staticmethod
    def map_submission_data_keys(
        data: Dict[str, Any],
        field_label_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Return a new dictionary where keys are replaced by labels from the map.
        
        Args:
            data: Submission data dictionary
            field_label_map: Map of field IDs to labels
            
        Returns:
            Dictionary with labeled keys
        """
        mapped_data = {}
        for key, value in data.items():
            label = field_label_map.get(key, key)
            mapped_data[label] = value
        return mapped_data

