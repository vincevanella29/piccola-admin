# config/gamification/service.py

"""
Central service module for gamification.

This module acts as a facade, importing and re-exporting functions
from the specialized service modules in this directory. This keeps the
code organized while providing a single, consistent access point for the API layer.
"""

# DAO and Proposal Services
from .dao_services import (
    get_company_dao_address_service,
    resolve_company_dao_address,
    bootstrap_special_via_dao_service,
    list_dao_proposals_service,
    build_vote_tx_service,
    build_execute_tx_service,
    build_create_segment_tx,
    build_set_fast_minter_tx,
    list_fast_minters,
)

# Batch Merit Services
from .batch_services import (
    plan_batch_merit,
    build_batch_txs_via_dao,
    mark_merits_as_minted,  # <-- Se añade la nueva función aquí
)

# Rules, Templates, and Catalogs
from .rules_services import (
    save_meritocracy_rule,
    list_meritocracy_rules,
    list_catalogs,
    list_rule_templates_service,
    validate_and_save_rule_from_template,
    update_meritocracy_rule,
)

# Segment Permission Services
from .segment_services import (
    build_allow_dao_tx,
    list_allowed_daos_for_token,
    build_authorize_company_all_segments,
)
from .helpers import list_permitted_segments_for_company

# User Profile Services
from .profile_services import (
    user_profile_summary,
)

# Merit Preview Services
from .preview_services import (
    compute_merit_preview_points,
)

# AÑADE ESTA NUEVA IMPORTACIÓN
from .merit_results_services import (
    list_merit_results,
)

# Make all imported functions available for other modules
__all__ = [
    # DAO Services
    'get_company_dao_address_service',
    'resolve_company_dao_address',
    'bootstrap_special_via_dao_service',
    'list_dao_proposals_service',
    'build_vote_tx_service',
    'build_execute_tx_service',
    'build_create_segment_tx',
    'build_set_fast_minter_tx',
    'list_fast_minters',
    # Batch Services
    'plan_batch_merit',
    'build_batch_txs_via_dao',
    'mark_merits_as_minted',  # <-- Y se exporta aquí
    # Rules Services
    'save_meritocracy_rule',
    'list_meritocracy_rules',
    'list_catalogs',
    'list_rule_templates_service',
    'validate_and_save_rule_from_template',
    'update_meritocracy_rule',
    # Segment Services
    'build_allow_dao_tx',
    'list_allowed_daos_for_token',
    'build_authorize_company_all_segments',
    'list_permitted_segments_for_company',
    # Profile Services
    'user_profile_summary',
    # Preview Services
    'compute_merit_preview_points',
    # Merit Results Services
    'list_merit_results',
]