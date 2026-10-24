# ─────────────────────────────────────────────────────────────────────────────
#  ytstudio — common tasks
# ─────────────────────────────────────────────────────────────────────────────
SHELL := /bin/bash
PY    := .venv/bin/python
TOOLS := .tools

.DEFAULT_GOAL := help
.PHONY: help bootstrap doctor test sample plan render verify remotion fonts env presets clean clean-all demo-project

help:  ## show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

bootstrap:  ## install/verify the whole toolchain
	./bootstrap.sh

doctor:  ## environment + capability report
	@$(PY) -m ytstudio doctor

presets:  ## list export presets
	@$(PY) -m ytstudio presets

test:  ## run the full test suite
	@$(PY) -m pytest tests -q

sample:  ## render the end-to-end demo video (1080p30)
	@$(PY) -m ytstudio sample

plan:  ## timeline of a project:  make plan P=projects/my-video
	@$(PY) -m ytstudio plan $(P)

render:  ## render a project:     make render P=projects/my-video
	@$(PY) -m ytstudio render $(P)

draft:  ## fast 720p preview:     make draft P=projects/my-video
	@$(PY) -m ytstudio render $(P) --draft

verify:  ## check a file:         make verify F=output/x-1920x1080.mp4
	@$(PY) -m ytstudio verify $(F)

remotion:  ## render the Remotion motion-graphics library
	@bash scripts/render_remotion_assets.sh

fonts:  ## reinstall/download fonts
	@$(PY) scripts/install_fonts.py

clean:  ## remove render intermediates of a project
	rm -rf $(P)/build

clean-all:  ## remove every build/output artefact
	rm -rf projects/*/build projects/*/output output
