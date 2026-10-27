extends RefCounted
const TEXT := Color(0.93, 0.94, 0.87)
const MUTED := Color(0.61, 0.71, 0.68)
const GOLD := Color(1.0, 0.70, 0.31)
const DARK := Color(0.055, 0.10, 0.11, 0.97)
const TEAL := Color(0.15, 0.46, 0.43)

static func box(bg: Color, border: Color = Color.TRANSPARENT, radius: int = 8, border_width: int = 1) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	return style

static func label(text: String, size: int = 18, color: Color = TEXT) -> Label:
	var item = Label.new()
	item.text = text
	item.add_theme_font_size_override("font_size", size)
	item.add_theme_color_override("font_color", color)
	return item

static func button(text: String, primary: bool = false) -> Button:
	var item = Button.new()
	item.text = text
	item.custom_minimum_size = Vector2(0, 48)
	item.focus_mode = Control.FOCUS_ALL
	var fill = GOLD if primary else Color(0.10, 0.17, 0.17, 0.95)
	var ink = Color(0.12, 0.13, 0.10) if primary else TEXT
	item.add_theme_color_override("font_color", ink)
	item.add_theme_color_override("font_hover_color", ink if primary else Color.WHITE)
	item.add_theme_color_override("font_pressed_color", ink)
	item.add_theme_font_size_override("font_size", 16)
	item.add_theme_stylebox_override("normal", box(fill, Color(0.32, 0.44, 0.40) if not primary else GOLD, 6))
	item.add_theme_stylebox_override("hover", box(fill.lightened(0.12), GOLD, 6, 2))
	item.add_theme_stylebox_override("pressed", box(fill.darkened(0.12), GOLD, 6, 2))
	item.add_theme_stylebox_override("focus", box(Color.TRANSPARENT, GOLD, 6, 2))
	return item

static func panel(color: Color = DARK) -> PanelContainer:
	var item = PanelContainer.new()
	item.add_theme_stylebox_override("panel", box(color, Color(0.28, 0.40, 0.37), 10))
	return item
