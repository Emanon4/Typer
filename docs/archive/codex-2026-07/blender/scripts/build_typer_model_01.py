from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
EXPORT_DIR = ROOT / "exports"
RENDER_DIR = ROOT / "renders"
BLEND_PATH = ROOT / "Typer_Model_01.blend"
GLB_PATH = EXPORT_DIR / "typer-model-01.glb"
MANIFEST_PATH = EXPORT_DIR / "typer-model-01.manifest.json"
VALIDATION_PATH = EXPORT_DIR / "typer-model-01.validation.json"

EXPORT_DIR.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def collection(name: str, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def move_to_collection(obj, col):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)


def principled_material(name, color, metallic=0.0, roughness=0.45, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    return mat


def worn_material(name, color, metallic, roughness, noise_scale=38.0, bump=0.08):
    mat = principled_material(name, color, metallic, roughness, 0.12)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = noise_scale
    tex.inputs["Detail"].default_value = 5.0
    tex.inputs["Roughness"].default_value = 0.72
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (roughness * 0.45,) * 3 + (1.0,)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (min(roughness * 1.35, 1.0),) * 3 + (1.0,)
    bump_node = nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = bump
    bump_node.inputs["Distance"].default_value = 0.00018
    links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])
    links.new(tex.outputs["Fac"], bump_node.inputs["Height"])
    links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def paper_material():
    mat = principled_material("Paper_Aged_Cotton", (0.34, 0.28, 0.17, 1), 0.0, 0.78)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 115.0
    noise.inputs["Detail"].default_value = 3.2
    noise.inputs["Roughness"].default_value = 0.82
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.18, 0.135, 0.075, 1)
    ramp.color_ramp.elements[1].color = (0.48, 0.39, 0.23, 1)
    bump_node = nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = 0.16
    bump_node.inputs["Distance"].default_value = 0.00042
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def wood_material():
    mat = principled_material("Desk_Walnut", (0.025, 0.008, 0.002, 1), 0.0, 0.5, 0.08)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 4.2
    tex.inputs["Detail"].default_value = 6.0
    tex.inputs["Roughness"].default_value = 0.72
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.7, 9.0, 1.0)
    coord = nodes.new("ShaderNodeTexCoord")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.012, 0.003, 0.001, 1)
    ramp.color_ramp.elements[1].color = (0.065, 0.014, 0.003, 1)
    bump_node = nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = 0.15
    bump_node.inputs["Distance"].default_value = 0.004
    links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(tex.outputs["Fac"], bump_node.inputs["Height"])
    links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def assign(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)
    return obj


def beveled_box(name, loc, dims, mat, bevel=0.006, col=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Edge_Radius", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    assign(obj, mat)
    if col:
        move_to_collection(obj, col)
    return obj


def cylinder(name, radius, depth, loc, mat, rotation=(0, 0, 0), vertices=64, col=None, bevel=0.001):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    if bevel > 0:
        mod = obj.modifiers.new("Edge_Radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    assign(obj, mat)
    if col:
        move_to_collection(obj, col)
    return obj


def uv_sphere(name, radius, loc, mat, col=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    if col:
        move_to_collection(obj, col)
    return obj


def empty(name, loc=(0, 0, 0), col=None, display="PLAIN_AXES", size=0.022):
    obj = bpy.data.objects.new(name, None)
    obj.location = loc
    obj.empty_display_type = display
    obj.empty_display_size = size
    (col or bpy.context.scene.collection).objects.link(obj)
    return obj


def parent_keep_world(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def beam(name, start, end, radius, mat, col=None, parent=None, rectangular=False):
    start = Vector(start)
    end = Vector(end)
    vec = end - start
    length = vec.length
    midpoint = (start + end) * 0.5
    if rectangular:
        obj = beveled_box(name, midpoint, (radius * 2.0, radius, length), mat, radius * 0.25, col)
    else:
        obj = cylinder(name, radius, length, midpoint, mat, col=col, bevel=radius * 0.35)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = vec.to_track_quat("Z", "Y")
    if parent:
        parent_keep_world(obj, parent)
    return obj


def curve_tube(name, points, radius, mat, col=None, cyclic=False):
    curve_data = bpy.data.curves.new(name + "_Curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1.0)
    spline.order_u = min(3, len(points))
    spline.use_endpoint_u = not cyclic
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve_data)
    (col or bpy.context.scene.collection).objects.link(obj)
    assign(obj, mat)
    return obj


def extruded_xz_profile(name, points, depth, y_center, mat, col=None, bevel=0.002):
    """Create a thin cast panel from a front-view X/Z silhouette."""
    count = len(points)
    front_y = y_center - depth * 0.5
    back_y = y_center + depth * 0.5
    vertices = [(x, front_y, z) for x, z in points] + [(x, back_y, z) for x, z in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    (col or bpy.context.scene.collection).objects.link(obj)
    assign(obj, mat)
    if bevel:
        modifier = obj.modifiers.new("Cast_Edge_Radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    return obj


def extruded_yz_profile(name, points, width, x_center, mat, col=None, bevel=0.002):
    """Create a left/right cast frame from a side-view Y/Z silhouette."""
    count = len(points)
    left_x = x_center - width * 0.5
    right_x = x_center + width * 0.5
    vertices = [(left_x, y, z) for y, z in points] + [(right_x, y, z) for y, z in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    (col or bpy.context.scene.collection).objects.link(obj)
    assign(obj, mat)
    if bevel:
        modifier = obj.modifiers.new("Cast_Edge_Radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    return obj


def make_text(name, body, loc, size, mat, col=None):
    data = bpy.data.curves.new(name + "_Text", "FONT")
    data.body = body
    data.align_x = "CENTER"
    data.align_y = "CENTER"
    data.size = size
    data.extrude = 0.00018
    data.bevel_depth = 0.00008
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    (col or bpy.context.scene.collection).objects.link(obj)
    assign(obj, mat)
    return obj


def make_paper_mesh(name, carriage_root, paper_root, mat, col):
    width = 0.210
    rows = 42
    t_min = -0.073
    t_max = 0.250
    platen_y = 0.104
    platen_z = 0.228
    radius = 0.0265
    vertices = []
    uvs = []
    for row in range(rows):
        v = row / (rows - 1)
        t = t_min + (t_max - t_min) * v
        for side in (0, 1):
            x = (-0.5 + side) * width
            curl = 0.0012 * (abs(x) / (width * 0.5)) ** 2
            if t < 0:
                theta = (t / abs(t_min)) * -2.20
                y = platen_y - radius * math.cos(theta)
                z = platen_z + radius * math.sin(theta)
            else:
                y = platen_y - radius - 0.0006
                z = platen_z + t + curl
            vertices.append((x, y, z))
            uvs.append((side, v))
    faces = []
    for row in range(rows - 1):
        a = row * 2
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="PaperUV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    assign(obj, mat)
    solidify = obj.modifiers.new("Paper_Thickness", "SOLIDIFY")
    solidify.thickness = 0.00022
    solidify.offset = 0.0
    obj.parent = paper_root
    obj["runtime_surface"] = "dynamic_canvas_texture"
    obj["physical_width_m"] = width
    obj["physical_height_m"] = 0.297
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


clear_scene()

scene = bpy.context.scene
scene.name = "Typer_Model_01_Scene"
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.frame_start = 1
scene.frame_end = 60
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world.color = (0.006, 0.004, 0.003)
scene.view_settings.exposure = -1.15
scene["typer_model"] = "Typer Model 01"
scene["mechanism_version"] = "0.2.0"
scene["cjk_adapter"] = "hidden_digital_type_slug"
scene["unit"] = "metre"
scene["reference_machine"] = "1924 front-strike standard typewriter; Underwood No.5 museum dimensions"

master = collection("TYPR_Model_01")
body_col = collection("01_Body", master)
keyboard_col = collection("02_Keyboard", master)
mechanism_col = collection("03_Typebar_Mechanism", master)
carriage_col = collection("04_Carriage_And_Paper", master)
rig_col = collection("05_Rig_Controls", master)
stage_col = collection("06_Stage", master)

black = worn_material("Black_Crackle_Enamel", (0.0025, 0.0032, 0.0045, 1), 0.22, 0.24, 62.0, 0.018)
steel = worn_material("Blued_Steel", (0.008, 0.012, 0.018, 1), 0.90, 0.24, 68.0, 0.018)
brass = worn_material("Aged_Brass", (0.115, 0.052, 0.010, 1), 0.90, 0.28, 48.0, 0.014)
nickel = worn_material("Aged_Nickel", (0.19, 0.20, 0.21, 1), 0.92, 0.20, 72.0, 0.010)
rubber = principled_material("Platen_Rubber", (0.0015, 0.0018, 0.0022, 1), 0.0, 0.76)
ivory = principled_material("Key_Ivory", (0.27, 0.21, 0.12, 1), 0.0, 0.42, 0.14)
ink = principled_material("Ink_Black", (0.002, 0.001, 0.001, 1), 0.05, 0.70)
ribbon_mat = principled_material("Ink_Ribbon_Fabric", (0.006, 0.002, 0.0015, 1), 0.0, 0.96)
gold = principled_material("Typer_Gold_Leaf", (0.32, 0.115, 0.012, 1), 0.72, 0.30, 0.12)
felt = principled_material("Typebar_Rest_Felt", (0.035, 0.008, 0.004, 1), 0.0, 0.98)
paper = paper_material()
wood = wood_material()

# Stage and a museum-dimensioned open cast frame. The outside envelope follows
# the 390 x 320 x 250 mm Underwood No.5 held by Museums Victoria, while the
# branding and hidden character adapter remain Typer's own design.
beveled_box("Desk_Surface", (0, 0.02, -0.018), (1.35, 0.90, 0.035), wood, 0.012, stage_col)
beveled_box("Base_Front_Rail", (0, -0.170, 0.035), (0.390, 0.025, 0.045), black, 0.010, body_col)
beveled_box("Base_Rear_Rail", (0, 0.137, 0.035), (0.390, 0.025, 0.045), black, 0.010, body_col)
beveled_box("Base_Left_Rail", (-0.182, -0.017, 0.035), (0.026, 0.295, 0.045), black, 0.010, body_col)
beveled_box("Base_Right_Rail", (0.182, -0.017, 0.035), (0.026, 0.295, 0.045), black, 0.010, body_col)
for x in (-0.172, 0.172):
    for y in (-0.145, 0.115):
        cylinder(f"Rubber_Foot_{x:+.3f}_{y:+.3f}", 0.013, 0.018, (x, y, 0.006), rubber, col=body_col, vertices=40, bevel=0.002)

side_profile = (
    (-0.158, 0.052),
    (-0.136, 0.088),
    (-0.055, 0.112),
    (0.034, 0.135),
    (0.076, 0.235),
    (0.119, 0.247),
    (0.142, 0.225),
    (0.142, 0.050),
)
extruded_yz_profile("Left_Cast_Frame", side_profile, 0.034, -0.166, black, body_col, 0.004)
extruded_yz_profile("Right_Cast_Frame", side_profile, 0.034, 0.166, black, body_col, 0.004)
beveled_box("Keyboard_Bed", (0, -0.100, 0.078), (0.328, 0.142, 0.012), black, 0.004, body_col, rotation=(math.radians(-6), 0, 0))

apron_profile = [(-0.170, 0.102), (-0.170, 0.186), (-0.137, 0.186)]
for index in range(15):
    x = -0.137 + index * (0.274 / 14)
    normalized = x / 0.137
    z = 0.112 + 0.074 * (abs(normalized) ** 1.65)
    apron_profile.append((x, z))
apron_profile.extend([(0.170, 0.186), (0.170, 0.102)])
extruded_xz_profile("Front_Cast_Apron", apron_profile, 0.022, -0.018, black, body_col, 0.003)

brand = make_text("Typer_Front_Brand", "TYPER · MODEL 01", (0, -0.1832, 0.038), 0.013, gold, body_col)
brand.rotation_euler = (math.radians(90), 0, 0)
brand.data.extrude = 0.00008
brand.data.bevel_depth = 0.00004
for side in (-1, 1):
    line = beveled_box(f"Front_Gold_Pinstripe_{side:+d}", (side * 0.146, -0.1835, 0.038), (0.050, 0.0007, 0.0010), gold, 0.0002, body_col)

beveled_box("Spacebar", (0, -0.174, 0.087), (0.224, 0.020, 0.012), rubber, 0.005, keyboard_col)

# Basket segment and common guide. The U-shaped slotted segment is the common
# fulcrum for every typebar; the separate felt arc is where the slugs rest.
arc_points = []
for i in range(35):
    theta = math.radians(198 + i * (144 / 34))
    arc_points.append((0.150 * math.cos(theta), 0.018, 0.176 + 0.076 * math.sin(theta)))
curve_tube("Typebar_Segment_Outer", arc_points, 0.0062, nickel, mechanism_col)
inner_points = [(x * 0.86, y - 0.001, 0.176 + (z - 0.176) * 0.80) for x, y, z in arc_points]
curve_tube("Typebar_Segment_Inner", inner_points, 0.0042, steel, mechanism_col)
felt_points = [(x * 1.03, -0.057, z - 0.010) for x, _, z in arc_points]
curve_tube("Typebar_Rest_Felt", felt_points, 0.0048, felt, mechanism_col)
beveled_box("Type_Guide", (0, 0.076, 0.228), (0.016, 0.008, 0.024), nickel, 0.0016, mechanism_col)
strike_point = empty("Strike_Point", (0, 0.075, 0.229), rig_col, "SPHERE", 0.008)
strike_point["runtime_event"] = "commit_ink"
strike_point["threshold_m"] = 0.001

# Ribbon system.
for side in (-1, 1):
    cylinder(f"Ribbon_Spool_{'L' if side < 0 else 'R'}", 0.025, 0.010, (side * 0.116, 0.052, 0.194), steel, col=mechanism_col, vertices=64, bevel=0.0014)
    cylinder(f"Ribbon_Hub_{'L' if side < 0 else 'R'}", 0.006, 0.014, (side * 0.116, 0.052, 0.196), brass, col=mechanism_col, vertices=40, bevel=0.001)
beveled_box("Ribbon", (0, 0.061, 0.226), (0.240, 0.0012, 0.012), ribbon_mat, 0.0003, mechanism_col)
ribbon_vibrator = beveled_box("Ribbon_Vibrator", (0, 0.066, 0.221), (0.030, 0.006, 0.020), steel, 0.002, mechanism_col)
ribbon_vibrator["mechanism"] = "ribbon_lift"

# Forty-two flat stamped typebars, matching the museum machine's count. Every
# bar starts on the felt rest and rotates about its own segment fulcrum to the
# same visible printing point.
typebar_pivots = []
active_pivot = None
active_typebar_index = 21
for index in range(42):
    u = index / 41
    angle = math.radians(-70 + 140 * u)
    pivot_pos = Vector((0.138 * math.sin(angle), 0.020, 0.172 - 0.050 * math.cos(angle)))
    hit_vector = Vector(strike_point.location) - pivot_pos
    bar_length = hit_vector.length
    # The basket is read from the front: the fulcrums spread across the
    # U-shaped segment while the idle typeheads settle toward the central
    # shot-pad. This avoids the physically false "horizontal roof" produced by
    # sending every bar straight toward the operator.
    rest_target = Vector((pivot_pos.x * 0.24, -0.035, 0.108 + 0.005 * math.cos(angle)))
    rest_vector = (rest_target - pivot_pos).normalized() * bar_length
    pivot_name = "Typebar_H" if index == active_typebar_index else f"Typebar_{index:02d}"
    pivot = empty(pivot_name, pivot_pos, rig_col, "ARROWS", 0.012)
    pivot.rotation_mode = "QUATERNION"
    rest_q = rest_vector.to_track_quat("Z", "Y")
    hit_q = hit_vector.to_track_quat("Z", "Y")
    pivot.rotation_quaternion = rest_q
    pivot["mechanism"] = "typebar"
    pivot["pivot_m"] = [round(v, 6) for v in pivot_pos]
    pivot["strike_point"] = "Strike_Point"
    pivot["bar_length_m"] = round(bar_length, 6)

    bar = beveled_box(
        pivot_name + "_Arm",
        (0, 0, bar_length * 0.5),
        (0.0048, 0.0017, bar_length),
        steel,
        0.00045,
        mechanism_col,
    )
    bar.parent = pivot
    bar.location = (0, 0, bar_length * 0.5)
    bar.rotation_euler = (0, 0, 0)
    head = beveled_box(
        pivot_name + "_Slug",
        (0, 0, bar_length),
        (0.0095, 0.0045, 0.0115),
        nickel,
        0.0009,
        mechanism_col,
    )
    head.parent = pivot
    head.location = (0, 0, bar_length)
    head.rotation_euler = (0, 0, 0)
    head["glyph_source"] = "hidden_cjk_adapter" if index == 16 else "latin_slug"
    typebar_pivots.append((pivot, rest_q, hit_q))
    if index == active_typebar_index:
        active_pivot = pivot

# Universal bar follows the segment and releases the escapement.
universal_points = [(x * 0.90, y + 0.008, z + 0.008) for x, y, z in inner_points]
universal_bar = curve_tube("Universal_Bar", universal_points, 0.0032, brass, mechanism_col)
universal_bar["mechanism"] = "escapement_release"
beveled_box("Escapement_Rack", (0, 0.122, 0.180), (0.305, 0.008, 0.012), steel, 0.0015, carriage_col)

# Keyboard. Every cap is an independent runtime target; H drives the first rigged chain.
rows = [
    ("1234567890-=", -0.055, 0.000),
    ("QWERTYUIOP[]", -0.088, 0.008),
    ("ASDFGHJKL;'", -0.121, 0.017),
    ("ZXCVBNM,./", -0.154, 0.031),
]
active_key = None
for row_index, (labels, y, inset) in enumerate(rows):
    spacing = 0.026
    start_x = -((len(labels) - 1) * spacing) * 0.5 + inset
    for key_index, label in enumerate(labels):
        x = start_x + key_index * spacing
        z = 0.118 - row_index * 0.010
        safe = {
            "[": "LBRACKET",
            "]": "RBRACKET",
            ";": "SEMICOLON",
            "'": "APOSTROPHE",
            ",": "COMMA",
            ".": "PERIOD",
            "/": "SLASH",
            "-": "MINUS",
            "=": "EQUALS",
        }.get(label, label)
        root = empty(f"Key_{safe}", (x, y, z), keyboard_col, "CUBE", 0.007)
        root["mechanism"] = "key"
        root["logical_key"] = label
        stem_depth = max(z - 0.070, 0.014)
        stem = cylinder(f"Key_{safe}_Stem", 0.0026, stem_depth, (x, y, z - stem_depth * 0.5 - 0.003), nickel, col=keyboard_col, vertices=24, bevel=0.0005)
        rim = cylinder(f"Key_{safe}_Rim", 0.0105, 0.0065, (x, y, z), nickel, col=keyboard_col, vertices=40, bevel=0.0012)
        insert = cylinder(f"Key_{safe}_Top", 0.0084, 0.0022, (x, y, z + 0.0041), ivory, col=keyboard_col, vertices=40, bevel=0.0007)
        legend = make_text(f"Key_{safe}_Legend", label, (x, y, z + 0.0055), 0.0066, ink, keyboard_col)
        parent_keep_world(stem, root)
        parent_keep_world(rim, root)
        parent_keep_world(insert, root)
        parent_keep_world(legend, root)
        lever = beam(
            f"Key_{safe}_Lever_Rod",
            (x, y + 0.003, z - 0.015),
            (x * 0.82, 0.012, 0.060),
            0.00135,
            steel,
            keyboard_col,
        )
        lever["mechanism"] = "key_lever_visual"
        if label == "H":
            active_key = root

key_lever = beam("Key_Lever_H", active_key.location + Vector((0, 0.006, -0.013)), (0, -0.004, 0.082), 0.0022, steel, keyboard_col)
key_lever["mechanism"] = "key_lever"
sublever_pivot = empty("Sublever_H", (0, -0.004, 0.082), rig_col, "ARROWS", 0.011)
sublever_pivot.rotation_mode = "XYZ"
sublever = beam("Sublever_H_Link", (0, -0.004, 0.082), tuple(active_pivot.location), 0.0018, brass, mechanism_col)
sublever["mechanism"] = "sublever"

# Carriage hierarchy.
carriage_root = empty("Carriage_Root", (0, 0, 0), rig_col, "CUBE", 0.025)
carriage_root["mechanism"] = "spring_carriage"
carriage_root["pitch_m"] = 0.0072
paper_root = empty("Paper_Feed_Root", (0, 0, 0), rig_col, "CUBE", 0.018)
paper_root.parent = carriage_root
paper_root["mechanism"] = "platen_feed"
paper_root["line_feed_m"] = 0.0085

rail = cylinder("Carriage_Rail", 0.0055, 0.355, (0, 0.108, 0.177), nickel, rotation=(0, math.pi / 2, 0), col=carriage_col)
parent_keep_world(rail, carriage_root)
platen_spin_root = empty("Platen_Spin_Root", (0, 0.104, 0.228), rig_col, "CIRCLE", 0.018)
platen_spin_root.parent = carriage_root
platen_spin_root["mechanism"] = "platen_rotation_axis"
platen = cylinder("Platen_Roller", 0.0265, 0.252, (0, 0.104, 0.228), rubber, rotation=(0, math.pi / 2, 0), col=carriage_col)
parent_keep_world(platen, platen_spin_root)
platen["mechanism"] = "platen"
platen["museum_reference_width_m"] = 0.252
for side in (-1, 1):
    knob = cylinder(
        f"Platen_Knob_{'L' if side < 0 else 'R'}",
        0.027,
        0.025,
        (side * 0.158, 0.104, 0.228),
        rubber,
        rotation=(0, math.pi / 2, 0),
        col=carriage_col,
        vertices=48,
        bevel=0.002,
    )
    parent_keep_world(knob, platen_spin_root)
    bracket = beveled_box(
        f"Carriage_End_{'L' if side < 0 else 'R'}",
        (side * 0.149, 0.102, 0.196),
        (0.026, 0.058, 0.070),
        black,
        0.008,
        carriage_col,
    )
    parent_keep_world(bracket, carriage_root)

bail = cylinder("Paper_Bail_Rod", 0.0028, 0.238, (0, 0.068, 0.259), nickel, rotation=(0, math.pi / 2, 0), col=carriage_col, vertices=32, bevel=0.0007)
parent_keep_world(bail, carriage_root)
for index, x in enumerate((-0.082, -0.028, 0.028, 0.082)):
    roller = cylinder(f"Paper_Bail_Roller_{index + 1}", 0.0075, 0.022, (x, 0.068, 0.259), rubber, rotation=(0, math.pi / 2, 0), col=carriage_col, vertices=40, bevel=0.0012)
    parent_keep_world(roller, carriage_root)

paper_table = beveled_box("Paper_Table", (0, 0.133, 0.294), (0.284, 0.010, 0.090), black, 0.006, carriage_col, rotation=(math.radians(-4), 0, 0))
parent_keep_world(paper_table, carriage_root)
table_brand = make_text("Typer_Paper_Table_Brand", "Typer", (0, 0.1265, 0.306), 0.033, gold, carriage_col)
table_brand.rotation_euler = (math.radians(90), 0, 0)
parent_keep_world(table_brand, carriage_root)

scale_bar = beveled_box("Margin_Scale", (0, 0.061, 0.199), (0.292, 0.010, 0.014), black, 0.002, carriage_col)
parent_keep_world(scale_bar, carriage_root)
for tick_index in range(41):
    x = -0.136 + tick_index * (0.272 / 40)
    tick_height = 0.006 if tick_index % 5 == 0 else 0.0035
    tick = beveled_box(f"Margin_Tick_{tick_index:02d}", (x, 0.0555, 0.202 + tick_height * 0.5), (0.0007, 0.0008, tick_height), gold, 0.00015, carriage_col)
    parent_keep_world(tick, carriage_root)
for side in (-1, 1):
    stop = beveled_box(f"Margin_Stop_{'L' if side < 0 else 'R'}", (side * 0.082, 0.052, 0.208), (0.013, 0.010, 0.020), nickel, 0.002, carriage_col)
    parent_keep_world(stop, carriage_root)

paper_obj = make_paper_mesh("Paper_A4_Deformed", carriage_root, paper_root, paper, carriage_col)

# Right-side bell and clapper, carried by the fixed frame.
bell = uv_sphere("Margin_Bell", 0.018, (0.161, 0.096, 0.166), brass, body_col, scale=(1.0, 1.0, 0.62))
bell["mechanism"] = "margin_bell"
cylinder("Bell_Post", 0.0025, 0.030, (0.161, 0.096, 0.145), nickel, col=body_col, vertices=24, bevel=0.0005)

# Return lever with one local-coordinate hierarchy, so the arm and grip cannot
# visually separate when the carriage translates or the lever rotates.
return_pivot = empty("Return_Lever_Pivot", (-0.172, 0.104, 0.246), rig_col, "ARROWS", 0.014)
return_pivot.parent = carriage_root
return_pivot.rotation_mode = "XYZ"
return_arm_points = (
    (0.0, 0.0, 0.0),
    (-0.035, -0.004, 0.039),
    (-0.108, -0.024, 0.057),
)
return_arm = curve_tube("Return_Lever_Arm", return_arm_points, 0.0042, brass, carriage_col)
return_arm.parent = return_pivot
handle_axis = Vector((-0.034, -0.008, 0.006))
handle_center = Vector(return_arm_points[-1]) + handle_axis * 0.48
return_handle = cylinder(
    "Return_Lever_Handle",
    0.0105,
    handle_axis.length,
    (0, 0, 0),
    rubber,
    col=carriage_col,
    vertices=48,
    bevel=0.0025,
)
return_handle.parent = return_pivot
return_handle.location = handle_center
return_handle.rotation_mode = "QUATERNION"
return_handle.rotation_quaternion = handle_axis.to_track_quat("Z", "Y")
return_pivot["mechanism"] = "carriage_return_and_line_feed"
return_pivot["grip_connection_local_m"] = [round(v, 6) for v in return_arm_points[-1]]

# Mechanical animation: idle → press → strike → escapement → carriage return and line feed.
def keyframe(obj, data_path, frame):
    obj.keyframe_insert(data_path=data_path, frame=frame)


active_key["animation_role"] = "active_key"
active_key.keyframe_insert(data_path="location", frame=1)
active_key.keyframe_insert(data_path="location", frame=6)
active_key.location.z -= 0.008
active_key.keyframe_insert(data_path="location", frame=10)
active_key.keyframe_insert(data_path="location", frame=13)
active_key.location.z += 0.008
active_key.keyframe_insert(data_path="location", frame=19)

sublever_pivot.keyframe_insert(data_path="rotation_euler", frame=1)
sublever_pivot.rotation_euler.x = math.radians(-12)
sublever_pivot.keyframe_insert(data_path="rotation_euler", frame=10)
sublever_pivot.rotation_euler.x = 0
sublever_pivot.keyframe_insert(data_path="rotation_euler", frame=19)

rest_q = active_pivot.rotation_quaternion.copy()
hit_q = typebar_pivots[active_typebar_index][2]
active_pivot.rotation_quaternion = rest_q
active_pivot.keyframe_insert(data_path="rotation_quaternion", frame=1)
active_pivot.keyframe_insert(data_path="rotation_quaternion", frame=8)
active_pivot.rotation_quaternion = hit_q
active_pivot.keyframe_insert(data_path="rotation_quaternion", frame=13)
active_pivot.keyframe_insert(data_path="rotation_quaternion", frame=14)
active_pivot.rotation_quaternion = rest_q
active_pivot.keyframe_insert(data_path="rotation_quaternion", frame=20)

ribbon_base = ribbon_vibrator.location.copy()
ribbon_vibrator.keyframe_insert(data_path="location", frame=1)
ribbon_vibrator.keyframe_insert(data_path="location", frame=8)
ribbon_vibrator.location.z += 0.010
ribbon_vibrator.keyframe_insert(data_path="location", frame=12)
ribbon_vibrator.keyframe_insert(data_path="location", frame=15)
ribbon_vibrator.location = ribbon_base
ribbon_vibrator.keyframe_insert(data_path="location", frame=20)

carriage_root.location.x = 0
carriage_root.keyframe_insert(data_path="location", frame=1)
carriage_root.keyframe_insert(data_path="location", frame=14)
carriage_root.location.x = -0.0072
carriage_root.keyframe_insert(data_path="location", frame=19)
carriage_root.keyframe_insert(data_path="location", frame=34)
carriage_root.location.x = 0
carriage_root.keyframe_insert(data_path="location", frame=50)

platen_spin_root.rotation_mode = "XYZ"
platen_spin_root.keyframe_insert(data_path="rotation_euler", frame=34)
platen_spin_root.rotation_euler.x += math.radians(18)
platen_spin_root.keyframe_insert(data_path="rotation_euler", frame=50)
paper_root.location.z = 0
paper_root.keyframe_insert(data_path="location", frame=34)
paper_root.location.z = 0.0085
paper_root.keyframe_insert(data_path="location", frame=50)
return_pivot.keyframe_insert(data_path="rotation_euler", frame=34)
return_pivot.rotation_euler.y = math.radians(-16)
return_pivot.rotation_euler.z = math.radians(8)
return_pivot.keyframe_insert(data_path="rotation_euler", frame=42)
return_pivot.rotation_euler = (0, 0, 0)
return_pivot.keyframe_insert(data_path="rotation_euler", frame=52)

# Make the short mechanical motions crisp without linear robotic stops.
for action in bpy.data.actions:
    for fcurve in getattr(action, "fcurves", ()):
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
            point.easing = "AUTO"


def evaluated_world_position(name: str, frame: int):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return bpy.data.objects[name].evaluated_get(depsgraph).matrix_world.translation.copy()


def validate_mechanism():
    required = (
        "Key_H",
        "Key_Lever_H",
        "Sublever_H",
        "Typebar_H",
        "Typebar_H_Slug",
        "Strike_Point",
        "Ribbon_Vibrator",
        "Universal_Bar",
        "Escapement_Rack",
        "Carriage_Root",
        "Platen_Spin_Root",
        "Platen_Roller",
        "Paper_Bail_Rod",
        "Paper_Feed_Root",
        "Paper_A4_Deformed",
        "Return_Lever_Pivot",
        "Return_Lever_Arm",
        "Return_Lever_Handle",
    )
    missing = [name for name in required if name not in bpy.data.objects]
    if missing:
        raise AssertionError(f"Missing required objects: {missing}")

    strike = evaluated_world_position("Strike_Point", 14)
    slug_at_strike = evaluated_world_position("Typebar_H_Slug", 14)
    strike_error = (slug_at_strike - strike).length
    if strike_error > 0.00015:
        raise AssertionError(f"Type slug misses strike point by {strike_error:.6f} m")

    pivot_idle = evaluated_world_position("Typebar_H", 1)
    slug_idle = evaluated_world_position("Typebar_H_Slug", 1)
    pivot_strike = evaluated_world_position("Typebar_H", 14)
    slug_strike = evaluated_world_position("Typebar_H_Slug", 14)
    idle_length = (slug_idle - pivot_idle).length
    strike_length = (slug_strike - pivot_strike).length
    expected_length = float(bpy.data.objects["Typebar_H"]["bar_length_m"])
    length_error = max(abs(idle_length - expected_length), abs(strike_length - expected_length))
    if length_error > 0.00015:
        raise AssertionError(f"Typebar length changes by {length_error:.6f} m")

    carriage_idle = evaluated_world_position("Carriage_Root", 1)
    carriage_advance = evaluated_world_position("Carriage_Root", 19)
    carriage_home = evaluated_world_position("Carriage_Root", 50)
    pitch = abs(carriage_advance.x - carriage_idle.x)
    home_error = (carriage_home - carriage_idle).length
    if abs(pitch - 0.0072) > 0.00005 or home_error > 0.00005:
        raise AssertionError("Carriage escapement or return distance is invalid")

    platen_alignment = []
    for frame in (1, 19, 42, 50):
        platen = evaluated_world_position("Platen_Roller", frame)
        spin_axis = evaluated_world_position("Platen_Spin_Root", frame)
        platen_alignment.append((platen - spin_axis).length)
    max_platen_offset = max(platen_alignment)
    if max_platen_offset > 0.00005:
        raise AssertionError(f"Platen detached from spin axis by {max_platen_offset:.6f} m")

    paper_obj = bpy.data.objects["Paper_A4_Deformed"]
    if paper_obj.parent != paper_root or paper_root.parent != carriage_root:
        raise AssertionError("Paper, feed root, and carriage do not share one hierarchy")
    if platen_spin_root.parent != carriage_root or return_pivot.parent != carriage_root:
        raise AssertionError("Platen or return lever is outside the carriage hierarchy")

    paper_idle = evaluated_world_position("Paper_Feed_Root", 34)
    paper_fed = evaluated_world_position("Paper_Feed_Root", 50)
    line_feed = paper_fed.z - paper_idle.z
    if abs(line_feed - 0.0085) > 0.00005:
        raise AssertionError(f"Line feed is {line_feed:.6f} m instead of 0.008500 m")

    checks = {
        "status": "passed",
        "blender_version": bpy.app.version_string,
        "required_object_count": len(required),
        "type_slug_strike_error_m": round(strike_error, 8),
        "typebar_max_length_error_m": round(length_error, 8),
        "carriage_pitch_m": round(pitch, 6),
        "carriage_home_error_m": round(home_error, 8),
        "platen_axis_max_offset_m": round(max_platen_offset, 8),
        "line_feed_m": round(line_feed, 6),
        "hierarchy": {
            "paper": "Paper_A4_Deformed > Paper_Feed_Root > Carriage_Root",
            "platen": "Platen_Roller > Platen_Spin_Root > Carriage_Root",
            "return_lever": "Return_Lever_Arm/Handle > Return_Lever_Pivot > Carriage_Root",
        },
    }
    VALIDATION_PATH.write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding="utf-8")
    return checks


validation = validate_mechanism()
print(f"Mechanical validation passed: {validation}")

# Camera and lighting.
bpy.ops.object.camera_add(location=(0.34, -0.82, 0.34))
camera = bpy.context.object
camera.name = "Camera_Hero_50mm"
camera.data.lens = 58
camera.data.sensor_width = 36
look_at(camera, (0, -0.020, 0.160))
move_to_collection(camera, stage_col)
scene.camera = camera

def area_light(name, loc, energy, color, size, target=(0, 0, 0.14)):
    data = bpy.data.lights.new(name + "_Data", "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    stage_col.objects.link(obj)
    look_at(obj, target)
    return obj


area_light("Key_Warm", (-0.42, -0.30, 0.62), 260, (1.0, 0.52, 0.24), 0.38)
area_light("Fill_Cool", (0.48, -0.12, 0.38), 120, (0.36, 0.52, 0.72), 0.30)
area_light("Paper_Softbox", (0.02, 0.18, 0.68), 180, (1.0, 0.82, 0.58), 0.32, (0, 0.08, 0.30))
area_light("Rim_Light", (0.0, 0.45, 0.35), 165, (0.56, 0.66, 1.0), 0.26, (0, 0.03, 0.19))

# Render, save, then export the complete named scene graph with animations and extras.
for frame, filename in ((1, "01-idle.png"), (14, "02-strike.png"), (48, "03-return.png")):
    scene.frame_set(frame)
    scene.render.filepath = str(RENDER_DIR / filename)
    bpy.ops.render.render(write_still=True)

bpy.ops.object.camera_add(location=(0.255, -0.455, 0.285))
mechanism_camera = bpy.context.object
mechanism_camera.name = "Camera_Mechanism_85mm"
mechanism_camera.data.lens = 82
look_at(mechanism_camera, (0, 0.035, 0.190))
move_to_collection(mechanism_camera, stage_col)
scene.camera = mechanism_camera
scene.frame_set(14)
scene.render.filepath = str(RENDER_DIR / "04-mechanism-strike-closeup.png")
bpy.ops.render.render(write_still=True)

bpy.ops.object.camera_add(location=(0, -0.80, 0.285))
front_camera = bpy.context.object
front_camera.name = "Camera_Front_58mm"
front_camera.data.lens = 58
look_at(front_camera, (0, -0.030, 0.155))
move_to_collection(front_camera, stage_col)
scene.camera = front_camera
for frame, filename in ((1, "05-front-idle.png"), (14, "06-front-strike.png")):
    scene.frame_set(frame)
    scene.render.filepath = str(RENDER_DIR / filename)
    bpy.ops.render.render(write_still=True)
scene.camera = camera

scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    export_animations=True,
    export_cameras=True,
    export_lights=False,
    export_extras=True,
    export_yup=True,
)

manifest = {
    "model": "Typer Model 01",
    "version": "0.1.0",
    "units": "metres",
    "runtime": "Three.js glTF/GLB",
    "truth_definition": "Mechanical motion is physically faithful; Chinese glyphs are committed by a hidden digital type-slug adapter.",
    "coordinates": {"x": "carriage travel", "y": "machine depth", "z": "height"},
    "primary_parts": [
        "Key_H",
        "Key_Lever_H",
        "Sublever_H",
        "Typebar_H",
        "Ribbon_Vibrator",
        "Strike_Point",
        "Universal_Bar",
        "Escapement_Rack",
        "Carriage_Root",
        "Platen_Roller",
        "Paper_Bail_Rod",
        "Paper_Feed_Root",
        "Paper_A4_Deformed",
        "Return_Lever_Pivot",
    ],
    "timeline": {
        "1": "idle",
        "10": "key bottom",
        "14": "type slug at strike point",
        "19": "escapement advances one pitch",
        "34": "return begins",
        "50": "carriage home and one line fed",
    },
    "acceptance": [
        "one fixed strike point",
        "constant typebar length",
        "paper and platen share carriage hierarchy",
        "A4 paper uses a stable UV space for runtime ink",
        "viewport changes move the camera only",
    ],
}
MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Saved {BLEND_PATH}")
print(f"Exported {GLB_PATH}")
print(f"Rendered previews to {RENDER_DIR}")
