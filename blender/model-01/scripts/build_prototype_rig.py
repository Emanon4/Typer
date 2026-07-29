from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent.parent
ASSET_DIR = PROJECT_ROOT / "public" / "assets"
BASE_REFERENCE = ASSET_DIR / "typewriter-base.png"
PAPER_REFERENCE = ASSET_DIR / "typewriter-with-paper.png"
EXPORT_DIR = ROOT / "exports"
RENDER_DIR = ROOT / "renders"
BLEND_PATH = ROOT / "Typer_Model_01_Prototype_Rig.blend"
GLB_PATH = EXPORT_DIR / "typer-model-01-prototype-rig.glb"
MANIFEST_PATH = EXPORT_DIR / "typer-model-01-prototype-rig.manifest.json"
VALIDATION_PATH = EXPORT_DIR / "typer-model-01-prototype-rig.validation.json"

IMAGE_WIDTH_PX = 1536
IMAGE_HEIGHT_PX = 1024
# The 391 px paper width in the selected artwork is calibrated to physical A4 width.
PIXELS_PER_METRE = 391.0 / 0.210
IMAGE_WIDTH_M = IMAGE_WIDTH_PX / PIXELS_PER_METRE
IMAGE_HEIGHT_M = IMAGE_HEIGHT_PX / PIXELS_PER_METRE
CARRIAGE_PITCH_M = 0.0072
LINE_FEED_M = 0.0085

EXPORT_DIR.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)


def px_to_world(px: float, py: float, depth_y: float = 0.0) -> Vector:
    return Vector(
        (
            (px - IMAGE_WIDTH_PX * 0.5) / PIXELS_PER_METRE,
            depth_y,
            (IMAGE_HEIGHT_PX - py) / PIXELS_PER_METRE,
        )
    )


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_collection(name: str):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to_collection(obj, target) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def parent_keep_world(obj, parent) -> None:
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def material(name: str, color, metallic=0.0, roughness=0.45, emission=None):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
            bsdf.inputs["Emission Strength"].default_value = 2.5
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = emission
    return result


def reference_material(name: str, image_path: Path):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(image_path), check_existing=True)
    texture.interpolation = "Closest"
    links.new(texture.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return result


def assign(obj, mat):
    if getattr(obj, "data", None) is not None and hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)
    return obj


def empty(name: str, location, collection, display="PLAIN_AXES", size=0.012):
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    obj.empty_display_type = display
    obj.empty_display_size = size
    collection.objects.link(obj)
    obj["exportable"] = True
    return obj


def box(name, location, dimensions, mat, collection, bevel=0.0015):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Small_Edge_Radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    assign(obj, mat)
    move_to_collection(obj, collection)
    obj["exportable"] = True
    return obj


def cylinder(name, location, radius, depth, mat, collection, rotation=(0.0, 0.0, 0.0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    move_to_collection(obj, collection)
    obj["exportable"] = True
    return obj


def beam(name, start, end, width, depth, mat, collection, parent=None):
    start_v = Vector(start)
    end_v = Vector(end)
    vector = end_v - start_v
    obj = box(
        name,
        (start_v + end_v) * 0.5,
        (width, depth, vector.length),
        mat,
        collection,
        bevel=min(width, depth) * 0.35,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = vector.to_track_quat("Z", "Y")
    if parent is not None:
        parent_keep_world(obj, parent)
    return obj


def tube_curve(name, points, radius, mat, collection, parent=None):
    curve_data = bpy.data.curves.new(name + "_Curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, curve_data)
    collection.objects.link(obj)
    assign(obj, mat)
    if parent is not None:
        parent_keep_world(obj, parent)
    return obj


def torus(name, location, major_radius, minor_radius, mat, collection, parent=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=location,
        rotation=(math.pi * 0.5, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    move_to_collection(obj, collection)
    if parent is not None:
        parent_keep_world(obj, parent)
    return obj


def image_plane(name: str, image_path: Path, collection, visible: bool):
    vertices = (
        (-IMAGE_WIDTH_M * 0.5, 0.12, 0.0),
        (IMAGE_WIDTH_M * 0.5, 0.12, 0.0),
        (IMAGE_WIDTH_M * 0.5, 0.12, IMAGE_HEIGHT_M),
        (-IMAGE_WIDTH_M * 0.5, 0.12, IMAGE_HEIGHT_M),
    )
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop, uv in zip(uv_layer.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = uv
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.name = name
    assign(obj, reference_material(name + "_Material", image_path))
    obj["reference_only"] = True
    obj["source_path"] = str(image_path)
    obj.hide_render = not visible
    obj.hide_select = True
    return obj


def set_world_quaternion(obj, direction: Vector) -> None:
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.normalized().to_track_quat("Z", "Y")


def key_quaternion(obj, frame: int, direction: Vector) -> None:
    set_world_quaternion(obj, direction)
    obj.keyframe_insert(data_path="rotation_quaternion", frame=frame)


def evaluated_position(name: str, frame: int) -> Vector:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return bpy.data.objects[name].evaluated_get(depsgraph).matrix_world.translation.copy()


clear_scene()
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "METERS"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = IMAGE_WIDTH_PX
scene.render.resolution_y = IMAGE_HEIGHT_PX
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = False
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 54
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.world.color = (0.003, 0.002, 0.001)
scene["product"] = "Typer"
scene["visible_design_source"] = "public/assets/typewriter-base.png + typewriter-with-paper.png"
scene["mechanism_scope"] = "one key, one typebar, ribbon lift, one escapement pitch, carriage return, line feed"
scene["cjk_contract"] = "A hidden digital type-slug adapter changes only the glyph mask at the real strike instant."

reference_collection = make_collection("REFERENCE_ONLY")
rig_collection = make_collection("TYPER_PROTOTYPE_RIG")
guide_collection = make_collection("ALIGNMENT_GUIDES")
stage_collection = make_collection("STAGE")

base_plane = image_plane(
    "Prototype_Base_Reference",
    BASE_REFERENCE,
    reference_collection,
    visible=False,
)
paper_plane = image_plane(
    "Prototype_Paper_Reference",
    PAPER_REFERENCE,
    reference_collection,
    visible=True,
)

black = material("Typer_Black_Enamel", (0.008, 0.006, 0.004, 1.0), 0.62, 0.24)
brass = material("Typer_Aged_Brass", (0.24, 0.105, 0.025, 1.0), 0.82, 0.3)
steel = material("Typer_Dark_Steel", (0.035, 0.03, 0.024, 1.0), 0.9, 0.25)
ribbon_material = material("Typer_Ink_Ribbon", (0.06, 0.004, 0.003, 1.0), 0.05, 0.7)
paper_material = material("Typer_A4_Cotton_Paper", (0.72, 0.62, 0.44, 1.0), 0.0, 0.84)
guide_gold = material(
    "Alignment_Gold",
    (0.7, 0.24, 0.035, 1.0),
    0.0,
    0.35,
    emission=(1.0, 0.22, 0.025, 1.0),
)
guide_red = material(
    "Strike_Red",
    (0.85, 0.03, 0.012, 1.0),
    0.0,
    0.4,
    emission=(1.0, 0.015, 0.005, 1.0),
)

# Frozen prototype anchors measured from the 1536x1024 artwork.
key_center = px_to_world(761.0, 797.0, -0.105)
typebar_pivot_position = px_to_world(756.0, 650.0, -0.025)
strike_position = px_to_world(770.5, 512.0, 0.018)
platen_center = px_to_world(770.5, 518.0, 0.040)
bail_center = px_to_world(770.5, 487.0, 0.008)
paper_top_center = px_to_world(770.5, 124.0, 0.055)

strike_point = empty("Strike_Point", strike_position, rig_collection, "SPHERE", 0.005)
strike_point["fixed_world_coordinate"] = True
strike_point["pixel_anchor"] = [770.5, 512.0]

carriage_root = empty("Carriage_Root", (0.0, 0.0, 0.0), rig_collection, "CUBE", 0.016)
carriage_root["carriage_pitch_m"] = CARRIAGE_PITCH_M
carriage_root["prototype_pixel_center_x"] = 770.5

platen_spin_root = empty("Platen_Spin_Root", platen_center, rig_collection, "CIRCLE", 0.018)
parent_keep_world(platen_spin_root, carriage_root)
platen = cylinder(
    "Platen_Roller",
    platen_center,
    0.0175,
    0.348,
    black,
    rig_collection,
    rotation=(0.0, math.pi * 0.5, 0.0),
    vertices=64,
)
parent_keep_world(platen, platen_spin_root)

paper_root = empty("Paper_Feed_Root", (0.0, 0.0, 0.0), rig_collection, "PLAIN_AXES", 0.014)
parent_keep_world(paper_root, carriage_root)
paper_center_z = paper_top_center.z - 0.297 * 0.5
paper = box(
    "Paper_A4",
    (paper_top_center.x, paper_top_center.y, paper_center_z),
    (0.210, 0.00035, 0.297),
    paper_material,
    rig_collection,
    bevel=0.0003,
)
parent_keep_world(paper, paper_root)
paper["physical_size_mm"] = [210, 297]

bail = cylinder(
    "Paper_Bail_Rod",
    bail_center,
    0.0021,
    0.338,
    brass,
    rig_collection,
    rotation=(0.0, math.pi * 0.5, 0.0),
    vertices=32,
)
parent_keep_world(bail, carriage_root)
for x_offset in (-0.062, 0.062):
    roller = cylinder(
        "Paper_Bail_Roller_L" if x_offset < 0 else "Paper_Bail_Roller_R",
        bail_center + Vector((x_offset, -0.001, 0.0)),
        0.0052,
        0.018,
        black,
        rig_collection,
        rotation=(0.0, math.pi * 0.5, 0.0),
        vertices=32,
    )
    parent_keep_world(roller, carriage_root)

escapement = box(
    "Escapement_Rack",
    (platen_center.x, 0.054, platen_center.z - 0.032),
    (0.31, 0.008, 0.006),
    steel,
    rig_collection,
    bevel=0.0007,
)
parent_keep_world(escapement, carriage_root)

return_pivot_position = px_to_world(470.0, 493.0, 0.016)
return_root = empty("Return_Lever_Pivot", return_pivot_position, rig_collection, "CIRCLE", 0.012)
parent_keep_world(return_root, carriage_root)
return_arm_end = px_to_world(337.0, 455.0, 0.010)
return_arm = beam(
    "Return_Lever_Arm",
    return_pivot_position,
    return_arm_end,
    0.007,
    0.005,
    brass,
    rig_collection,
    parent=return_root,
)
return_handle = cylinder(
    "Return_Lever_Handle",
    return_arm_end,
    0.008,
    0.024,
    black,
    rig_collection,
    rotation=(math.pi * 0.5, 0.0, 0.0),
    vertices=32,
)
parent_keep_world(return_handle, return_root)

key_root = empty("Key_H_Root", key_center, rig_collection, "CIRCLE", 0.012)
key_cap = cylinder(
    "Key_H",
    key_center,
    0.0115,
    0.008,
    black,
    rig_collection,
    rotation=(math.pi * 0.5, 0.0, 0.0),
    vertices=48,
)
parent_keep_world(key_cap, key_root)
key_ring = torus("Key_H_Brass_Ring", key_center + Vector((0.0, -0.0042, 0.0)), 0.0095, 0.0011, brass, rig_collection, key_root)

key_lever_pivot_position = key_center + Vector((0.0, 0.050, -0.018))
key_lever_root = empty("Key_Lever_H_Pivot", key_lever_pivot_position, rig_collection, "CIRCLE", 0.008)
key_lever = beam(
    "Key_Lever_H",
    key_lever_pivot_position,
    key_center + Vector((0.0, 0.005, -0.004)),
    0.004,
    0.003,
    steel,
    rig_collection,
    parent=key_lever_root,
)
sublever_pivot_position = typebar_pivot_position + Vector((0.0, 0.022, -0.020))
sublever_root = empty("Sublever_H_Pivot", sublever_pivot_position, rig_collection, "CIRCLE", 0.007)
sublever = beam(
    "Sublever_H",
    sublever_pivot_position,
    typebar_pivot_position,
    0.0035,
    0.0025,
    brass,
    rig_collection,
    parent=sublever_root,
)

typebar_root = empty("Typebar_H", typebar_pivot_position, rig_collection, "CIRCLE", 0.009)
strike_vector = strike_position - typebar_pivot_position
typebar_length = strike_vector.length
typebar = box(
    "Typebar_H_Bar",
    (0.0, 0.0, typebar_length * 0.5),
    (0.0030, 0.0024, typebar_length),
    steel,
    rig_collection,
    bevel=0.00055,
)
typebar.parent = typebar_root
typebar_slug = box(
    "Typebar_H_Slug",
    (0.0, 0.0, typebar_length),
    (0.010, 0.004, 0.005),
    brass,
    rig_collection,
    bevel=0.0007,
)
typebar_slug.parent = typebar_root
typebar_root["bar_length_m"] = typebar_length
typebar_root["glyph_source"] = "hidden digital type-slug adapter"

cjk_adapter = empty(
    "CJK_Digital_Type_Slug_Adapter",
    (0.0, 0.0, typebar_length + 0.004),
    rig_collection,
    "SINGLE_ARROW",
    0.006,
)
cjk_adapter.parent = typebar_root
cjk_adapter["visible_mechanism_override"] = False
cjk_adapter["commit_condition"] = "Typebar_H_Slug reaches Strike_Point"

ribbon_root = empty(
    "Ribbon_Vibrator",
    strike_position + Vector((0.0, -0.010, -0.010)),
    rig_collection,
    "PLAIN_AXES",
    0.008,
)
ribbon_left = box(
    "Ribbon_Left",
    ribbon_root.location + Vector((-0.030, 0.0, 0.0)),
    (0.055, 0.0012, 0.010),
    ribbon_material,
    rig_collection,
    bevel=0.0002,
)
ribbon_right = box(
    "Ribbon_Right",
    ribbon_root.location + Vector((0.030, 0.0, 0.0)),
    (0.055, 0.0012, 0.010),
    ribbon_material,
    rig_collection,
    bevel=0.0002,
)
parent_keep_world(ribbon_left, ribbon_root)
parent_keep_world(ribbon_right, ribbon_root)

# Camera-space calibration guides: clean overlays, not product geometry.
guide_depth = -0.155
guide_key_center = px_to_world(761.0, 797.0, guide_depth)
guide_pivot = px_to_world(756.0, 650.0, guide_depth)
guide_strike = px_to_world(770.5, 512.0, guide_depth)
guide_platen_left = px_to_world(445.0, 518.0, guide_depth)
guide_platen_right = px_to_world(1096.0, 518.0, guide_depth)
guide_bail_left = px_to_world(574.0, 487.0, guide_depth)
guide_bail_right = px_to_world(967.0, 487.0, guide_depth)

guide_key_root = empty("Guide_Key_H_Root", guide_key_center, guide_collection, "PLAIN_AXES", 0.006)
torus("Guide_Key_H", guide_key_center, 0.013, 0.0010, guide_gold, guide_collection, guide_key_root)
tube_curve("Guide_Platen_Axis", [guide_platen_left, guide_platen_right], 0.00075, guide_gold, guide_collection)
tube_curve("Guide_Paper_Bail", [guide_bail_left, guide_bail_right], 0.00065, guide_gold, guide_collection)
tube_curve(
    "Guide_Strike_Cross_H",
    [guide_strike + Vector((-0.012, 0.0, 0.0)), guide_strike + Vector((0.012, 0.0, 0.0))],
    0.0008,
    guide_red,
    guide_collection,
)
tube_curve(
    "Guide_Strike_Cross_V",
    [guide_strike + Vector((0.0, 0.0, -0.012)), guide_strike + Vector((0.0, 0.0, 0.012))],
    0.0008,
    guide_red,
    guide_collection,
)
guide_typebar_root = empty("Guide_Typebar_H", guide_pivot, guide_collection, "PLAIN_AXES", 0.006)
guide_typebar_length = (guide_strike - guide_pivot).length
guide_bar = box(
    "Guide_Typebar_H_Bar",
    (0.0, 0.0, guide_typebar_length * 0.5),
    (0.0022, 0.0012, guide_typebar_length),
    guide_gold,
    guide_collection,
    bevel=0.00045,
)
guide_bar.parent = guide_typebar_root
guide_slug = torus(
    "Guide_Typebar_H_Slug",
    (0.0, 0.0, guide_typebar_length),
    0.0055,
    0.0009,
    guide_red,
    guide_collection,
)
guide_slug.parent = guide_typebar_root
guide_slug.location = (0.0, 0.0, guide_typebar_length)

# Idle typebar retreats toward the operator in depth; strike remains exactly on the frozen image anchor.
idle_vector = Vector((0.002, -0.092, 0.036)).normalized() * typebar_length
key_quaternion(typebar_root, 1, idle_vector)
key_quaternion(typebar_root, 8, idle_vector)
key_quaternion(typebar_root, 14, strike_vector)
key_quaternion(typebar_root, 15, strike_vector)
key_quaternion(typebar_root, 22, idle_vector)

# The alignment guide uses the front projection of the same two poses.
guide_idle_vector = Vector((-0.014, 0.0, 0.036)).normalized() * guide_typebar_length
guide_strike_vector = guide_strike - guide_pivot
key_quaternion(guide_typebar_root, 1, guide_idle_vector)
key_quaternion(guide_typebar_root, 8, guide_idle_vector)
key_quaternion(guide_typebar_root, 14, guide_strike_vector)
key_quaternion(guide_typebar_root, 15, guide_strike_vector)
key_quaternion(guide_typebar_root, 22, guide_idle_vector)

key_root.keyframe_insert(data_path="location", frame=1)
key_root.keyframe_insert(data_path="location", frame=7)
key_root.location.z -= 0.005
key_root.keyframe_insert(data_path="location", frame=10)
key_root.keyframe_insert(data_path="location", frame=14)
key_root.location.z += 0.005
key_root.keyframe_insert(data_path="location", frame=20)

guide_key_root.keyframe_insert(data_path="location", frame=1)
guide_key_root.keyframe_insert(data_path="location", frame=7)
guide_key_root.location.z -= 0.005
guide_key_root.keyframe_insert(data_path="location", frame=10)
guide_key_root.keyframe_insert(data_path="location", frame=14)
guide_key_root.location.z += 0.005
guide_key_root.keyframe_insert(data_path="location", frame=20)

key_lever_root.rotation_mode = "XYZ"
key_lever_root.keyframe_insert(data_path="rotation_euler", frame=1)
key_lever_root.keyframe_insert(data_path="rotation_euler", frame=7)
key_lever_root.rotation_euler.x = math.radians(-7.0)
key_lever_root.keyframe_insert(data_path="rotation_euler", frame=10)
key_lever_root.keyframe_insert(data_path="rotation_euler", frame=14)
key_lever_root.rotation_euler.x = 0.0
key_lever_root.keyframe_insert(data_path="rotation_euler", frame=20)

sublever_root.rotation_mode = "XYZ"
sublever_root.keyframe_insert(data_path="rotation_euler", frame=1)
sublever_root.keyframe_insert(data_path="rotation_euler", frame=8)
sublever_root.rotation_euler.x = math.radians(11.0)
sublever_root.keyframe_insert(data_path="rotation_euler", frame=14)
sublever_root.rotation_euler.x = 0.0
sublever_root.keyframe_insert(data_path="rotation_euler", frame=22)

ribbon_root.keyframe_insert(data_path="location", frame=1)
ribbon_root.keyframe_insert(data_path="location", frame=9)
ribbon_root.location.z += 0.008
ribbon_root.keyframe_insert(data_path="location", frame=12)
ribbon_root.keyframe_insert(data_path="location", frame=15)
ribbon_root.location.z -= 0.008
ribbon_root.keyframe_insert(data_path="location", frame=20)

carriage_root.keyframe_insert(data_path="location", frame=1)
carriage_root.keyframe_insert(data_path="location", frame=15)
carriage_root.location.x = -CARRIAGE_PITCH_M
carriage_root.keyframe_insert(data_path="location", frame=20)
carriage_root.keyframe_insert(data_path="location", frame=35)
carriage_root.location.x = 0.0
carriage_root.keyframe_insert(data_path="location", frame=50)

paper_root.keyframe_insert(data_path="location", frame=35)
paper_root.location.z = LINE_FEED_M
paper_root.keyframe_insert(data_path="location", frame=50)

platen_spin_root.rotation_mode = "XYZ"
platen_spin_root.keyframe_insert(data_path="rotation_euler", frame=35)
platen_spin_root.rotation_euler.x = math.radians(18.0)
platen_spin_root.keyframe_insert(data_path="rotation_euler", frame=50)

return_root.rotation_mode = "XYZ"
return_root.keyframe_insert(data_path="rotation_euler", frame=35)
return_root.rotation_euler.y = math.radians(-13.0)
return_root.keyframe_insert(data_path="rotation_euler", frame=42)
return_root.rotation_euler.y = 0.0
return_root.keyframe_insert(data_path="rotation_euler", frame=52)

for action in bpy.data.actions:
    for fcurve in getattr(action, "fcurves", ()):
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
            point.easing = "AUTO"

# Pixel-locked orthographic camera. It changes no model coordinates.
bpy.ops.object.camera_add(location=(0.0, -1.25, IMAGE_HEIGHT_M * 0.5))
camera = bpy.context.object
camera.name = "Camera_Prototype_Alignment"
camera.data.type = "ORTHO"
# Blender's orthographic scale is the camera-frame width; the render aspect then derives height.
camera.data.ortho_scale = IMAGE_WIDTH_M
camera.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
move_to_collection(camera, stage_collection)
scene.camera = camera


def validate():
    required = (
        "Key_H",
        "Key_Lever_H",
        "Sublever_H",
        "Typebar_H",
        "Typebar_H_Slug",
        "Ribbon_Vibrator",
        "Strike_Point",
        "Escapement_Rack",
        "Carriage_Root",
        "Platen_Spin_Root",
        "Platen_Roller",
        "Paper_Bail_Rod",
        "Paper_Feed_Root",
        "Paper_A4",
        "Return_Lever_Pivot",
        "CJK_Digital_Type_Slug_Adapter",
    )
    missing = [name for name in required if name not in bpy.data.objects]
    if missing:
        raise AssertionError(f"Missing required rig objects: {missing}")

    strike = evaluated_position("Strike_Point", 14)
    slug = evaluated_position("Typebar_H_Slug", 14)
    strike_error = (slug - strike).length
    if strike_error > 0.00015:
        raise AssertionError(f"Type slug misses strike point by {strike_error:.7f} m")

    pivot_idle = evaluated_position("Typebar_H", 1)
    slug_idle = evaluated_position("Typebar_H_Slug", 1)
    pivot_strike = evaluated_position("Typebar_H", 14)
    slug_strike = evaluated_position("Typebar_H_Slug", 14)
    length_error = max(
        abs((slug_idle - pivot_idle).length - typebar_length),
        abs((slug_strike - pivot_strike).length - typebar_length),
    )
    if length_error > 0.00015:
        raise AssertionError(f"Typebar length changes by {length_error:.7f} m")

    carriage_idle = evaluated_position("Carriage_Root", 1)
    carriage_advanced = evaluated_position("Carriage_Root", 20)
    carriage_home = evaluated_position("Carriage_Root", 50)
    pitch = abs(carriage_advanced.x - carriage_idle.x)
    home_error = (carriage_home - carriage_idle).length
    if abs(pitch - CARRIAGE_PITCH_M) > 0.00005 or home_error > 0.00005:
        raise AssertionError("Escapement pitch or carriage home position is invalid")

    paper_idle = evaluated_position("Paper_Feed_Root", 35)
    paper_fed = evaluated_position("Paper_Feed_Root", 50)
    feed = paper_fed.z - paper_idle.z
    if abs(feed - LINE_FEED_M) > 0.00005:
        raise AssertionError(f"Line feed is {feed:.7f} m")

    if paper.parent != paper_root or paper_root.parent != carriage_root:
        raise AssertionError("Paper does not share the carriage hierarchy")
    if platen_spin_root.parent != carriage_root or bail.parent != carriage_root:
        raise AssertionError("Platen or paper bail detached from carriage")

    reference_objects = list(reference_collection.all_objects)
    if len(reference_objects) != 2 or not all(obj.get("reference_only") for obj in reference_objects):
        raise AssertionError("Reference collection is not isolated and tagged")

    export_names = {obj.name for obj in rig_collection.all_objects}
    leaked_references = sorted(obj.name for obj in reference_objects if obj.name in export_names)
    if leaked_references:
        raise AssertionError(f"Reference objects leaked into export set: {leaked_references}")

    checks = {
        "status": "passed",
        "blender_version": bpy.app.version_string,
        "visible_design_source": [
            str(BASE_REFERENCE.relative_to(PROJECT_ROOT)),
            str(PAPER_REFERENCE.relative_to(PROJECT_ROOT)),
        ],
        "image_calibration": {
            "resolution_px": [IMAGE_WIDTH_PX, IMAGE_HEIGHT_PX],
            "pixels_per_metre": round(PIXELS_PER_METRE, 6),
            "a4_width_px": 391,
            "a4_width_m": 0.210,
        },
        "required_rig_object_count": len(required),
        "type_slug_strike_error_m": round(strike_error, 8),
        "typebar_length_m": round(typebar_length, 8),
        "typebar_max_length_error_m": round(length_error, 8),
        "carriage_pitch_m": round(pitch, 6),
        "carriage_home_error_m": round(home_error, 8),
        "line_feed_m": round(feed, 6),
        "reference_objects_excluded_from_export": True,
        "paper_hierarchy": "Paper_A4 > Paper_Feed_Root > Carriage_Root",
        "prototype_anchors_px": {
            "key_h": [761.0, 797.0],
            "typebar_h_pivot": [756.0, 650.0],
            "strike_point": [770.5, 512.0],
            "platen_center": [770.5, 518.0],
            "paper_top_center": [770.5, 124.0],
        },
    }
    VALIDATION_PATH.write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding="utf-8")
    return checks


validation = validate()
print(f"Prototype-locked rig validation passed: {validation}")

# Alignment renders show only the selected Typer artwork and calibration guides.
rig_collection.hide_render = True
for frame, filename in (
    (1, "01-prototype-alignment-idle.png"),
    (14, "02-prototype-alignment-strike.png"),
):
    scene.frame_set(frame)
    scene.render.filepath = str(RENDER_DIR / filename)
    bpy.ops.render.render(write_still=True)

# Save the editable file with reference and guide collections visible in the viewport.
scene.frame_set(1)
rig_collection.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

# Export only articulated production objects. Image planes and calibration guides never enter the GLB.
bpy.ops.object.select_all(action="DESELECT")
for obj in rig_collection.all_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = key_root
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_yup=True,
)

manifest = {
    "model": "Typer Model 01 Prototype-Locked Rig",
    "version": "0.2.0",
    "units": "metres",
    "visible_design_source": [
        "public/assets/typewriter-base.png",
        "public/assets/typewriter-with-paper.png",
    ],
    "exterior_rule": "Blender may articulate and rebuild the selected Typer exterior but may not redesign it.",
    "scope": "one physically causal key-to-paper chain",
    "cjk_contract": "The hidden digital type-slug adapter changes the glyph mask only at physical strike.",
    "reference_collection_exported": False,
    "timeline": {
        "1": "idle",
        "10": "H key bottom",
        "14": "type slug at the fixed strike point and ribbon raised",
        "20": "escapement advances the carriage one pitch",
        "35": "return begins",
        "50": "carriage home and paper advanced one line",
    },
    "next_gate": "Replace blockout parts with finished surfaces inside the frozen silhouette; do not add more keys yet.",
}
MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Saved {BLEND_PATH}")
print(f"Exported {GLB_PATH}")
print(f"Rendered calibration previews to {RENDER_DIR}")
