"""
Hand-written scripts that bypass the template in script_builder.py.

build_script() checks MANUAL_SCRIPTS[slugify(title)] before falling back to
the auto-generated version, so any idea with an entry here renders from a
finished script instead of a first draft.

One module per content-system sheet. Importing them is what registers their
scripts, so the imports below are load-bearing despite looking unused.

To add a script: pick the right sheet module, call register() with the
title exactly as it appears in that sheet's Title column, and pair each
narration line with one image prompt. See _helpers.py for the shared
palettes, the img()/thumb() helpers, and the fact-check policy every script
in this package follows.
"""

from ._helpers import MANUAL_SCRIPTS
from . import gym_rats  # noqa: F401  -- imported for its register() side effects
from . import scam_mechanics  # noqa: F401
from . import trick_design  # noqa: F401

__all__ = ["MANUAL_SCRIPTS"]
