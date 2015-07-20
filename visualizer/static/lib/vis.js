host:var osm_map;
var target_feature_id = -1;

var xyzzy = 10;

var fixed_colors = ["#ff0000", "#00ff00","#0000ff","#000000","#ff00ff","#00ffff","#ffffff"]

FeatureType = Object.freeze({LINK: 0, NODE: 1, SEGMENT: 2, STOP: 3, WALK: 4, TRANSIT_OD: 5, TRANSIT_LINK: 6, TRANSIT_NODE: 7, TRANSIT_FEED: 8});

var base_z 					= 0
var contour_z				= 10;
var path_z					= 20;

var no_dataLayer_redraw 				= false;
var zoom					= 12;
var vis_coordinate_system; 
var underLayer;
var dataLayer;
var network_linkid_to_index 	= {};
var network_nodeid_to_index 	= {};
var busroutes 				= [];
var link_data				= 0;
var node_data 				= 0;
var current_timestep 		= 0;
var number_of_timesteps 	= 0;
var osm 					= 0;
var node_attributes			= [];
var node_features   		= [];
var	link_attributes			= [];
var link_features   		= [];
var transit_link_features   		= [];

var reachtime_origins		= [];
var OD_paths_origins		= [];
var OD_paths_destinations	= [];
var OD_paths    			= [];

var OD_distribution_tsteps = [];
var OD_distribution_data   = [];

var path_datasets			= [];
var RT_origin_nodes		    = [];

var path_properties 		= [];
var loading_default_path_data;
var map_intensity 			= 0.5;

var RT_view_mode = -1;

var current_selection_func;

var selecting_links_for_linkpaths = false;

var loading_default_path_data;
var theLinkColorMapper;
var theNodeColorMapper;
var theContourColorMapper;

var theLinkSizeMapper;
var theNodeSizeMapper;
var theContourSizeMapper;

var underLayerPopupControl;
var dataLayerPopupControl;
var selectionControl;

var popups_enabled = true;

var corridor_travel_times = {};
var corridor_travel_time_ranges = {};
var theAnimator;

var node_color_constant	= true;
var node_size_constant 	= true;
var link_color_constant 	= true;
var link_size_constant 	= true;

var origin_destination_nodes = [];

var segmentList = [];
var stopList = [];
var tripList = [];
var routeList = [];

var transitOD_mode = 0;
var transitOD_data = 0;

var transit_data = 0;

function render_timestep(n)
{
	current_timestep = n;
	dataLayer_redraw();
}

var latLon_scaling = 0.0001;

function pie(lon, lat, r, vals)
{
	r = r * latLon_scaling;
	
    var colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ff00', '#000000'];
    var center = new OpenLayers.Geometry.Point(lon, lat).transform(vis_coordinate_system, osm.projection);

    var sum = 0;
    for (var v in vals)
        sum = sum + vals[v];

    wedges = [];

    var last = 0;
    for (var v in vals)
    {
        var pts = [center];

        var part = vals[v] / sum;
        var np = 64 * part;
        var arc = 2.0 * Math.PI * part;
        for (var i = 0; i < np; i++)
        {
            var angle = last + (i / (np-1))*arc;
            pts.push(new OpenLayers.Geometry.Point(lon + r*Math.cos(angle), lat +r*Math.sin(angle)).transform(vis_coordinate_system, osm.projection));
        }

        l = new OpenLayers.Geometry.LinearRing(pts);
        p = new OpenLayers.Geometry.Polygon(l)
        w = new OpenLayers.Feature.Vector(p, null, {fillColor: colors[v], fillOpacity: 1.0, strokeWidth: 0});
        wedges.push(w);
        last = last + arc;
     }

     return wedges;
}

$(document).ready(function() {
	
	$.ajaxSetup({
		  beforeSend: function() {
			  document.getElementById("spinner_container").style.display = "inline";
		  },
		  complete: function(){
			  document.getElementById("spinner_container").style.display = "none";
		  },
		  success: function() {}
		});

	load_network(network_name);
	
	osm_map = new OpenLayers.Map("map");
	vis_coordinate_system = new OpenLayers.Projection("EPSG:4326");

	osm = new OpenLayers.Layer.OSM();
	osm.tileOptions.crossOriginKeyword = 'null';
	osm_map.addLayers([osm]);
	set_map_intensity(0.5)
    
	underLayer = new OpenLayers.Layer.Vector("UnderLayer");
	
	dataLayer = new OpenLayers.Layer.Vector("DataLayer", 
							{
								styleMap: new OpenLayers.StyleMap({graphicZIndex: "${zIndex}"}),
							    rendererOptions: {zIndexing: true}									
							});
	
	osm_map.addLayers([osm]);
	osm.setZIndex(0);
	
	osm_map.addLayers([underLayer]);
	underLayer.setZIndex(1001);
	
	osm_map.addLayers([dataLayer]);
	dataLayer.setZIndex(0);
   
	underLayerPopupControl = new OpenLayers.Control.SelectFeature(underLayer, {clickout: true})
	underLayer.events.on({'featureselected': popup, 'featureunselected': popdown})
	osm_map.addControl(underLayerPopupControl);
	underLayerPopupControl.activate();
	
	dataLayerPopupControl = new OpenLayers.Control.SelectFeature(dataLayer, {clickout: true})
	dataLayer.events.on({'featureselected': popup, 'featureunselected': popdown})
	osm_map.addControl(dataLayerPopupControl);
	dataLayerPopupControl.activate();
	
	selectionControl = new OpenLayers.Control.SelectFeature(dataLayer, {box: true, multiple: true, clickout: true});
	dataLayer.events.on({'featureselected': popup, 'featureunselected': popdown})
	osm_map.addControl(selectionControl)
	
	$("#dialog").dialog({autoOpen: false});

	$("#underlayer_preferences").dialog({autoOpen: false});

	$("#network_data_preferences").dialog({autoOpen: false});
	$("#network_data_preferences").on( "dialogclose", function(e,u) { dataLayer_redraw() });
 
	theLinkColorMapper = new ColorMapper("Link Colormapper", dataLayer_redraw);
	theNodeColorMapper = new ColorMapper("Node Colormapper", dataLayer_redraw);
	theContourColorMapper = new ColorMapper("Contour Colormapper", dataLayer_redraw);
	
	theLinkSizeMapper = new ValueMapper("Link Widthmapper", dataLayer_redraw);
	theNodeSizeMapper = new ValueMapper("Node Widthmapper", dataLayer_redraw);
	theContourSizeMapper = new ValueMapper("Contour Widthmapper", dataLayer_redraw);
	
	theLinkSizeMapper.SetValueRange(2, 6);
	theNodeSizeMapper.SetValueRange(2,20);
	theContourSizeMapper.SetValueRange(5,20)
	
	theAnimator = new AnimationControl(render_timestep);
	var animator_ui = theAnimator.GetUI();
	animator_ui.css('position', 'absolute');
	animator_ui.css('top', '0px');
	animator_ui.css('right', '0px');
	animator_ui.css('z-index', '1001');
	$('#map').append(animator_ui);
	
	html_string = ""
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			html_string += '<option value="' + d + '" selected>' + d + '</option>';
		else
			html_string += '<option value="' + d + '">' + d + '</option>';
	}

	$(".path_data_select").each(function(i, e) {$(this).html(html_string);});
	
	capture_underLayer_preferences();
});

function enableSelection(f, d)
{	
	dataLayer.events.remove('featureselected');
	dataLayer.events.on({'featureselected': f})
	if (d != null)
		selectionControl.events.register('boxselectionend', null, d)
	dataLayerPopupControl.deactivate();
	selectionControl.activate();
}

function disableSelection()
{
	dataLayer.events.un({'featureselected': current_selection_func})
	selectionControl.events.register('boxselectionend', null, null)
	selectionControl.deactivate();

	dataLayer.events.on({'featureselected': popup, 'featureunselected': popdown})
	dataLayerPopupControl.activate();
}

function position_map(lon, lat, d)
{
	zoom = 14 - 4*(d - 0.1) / (2.81 - 0.1)
	osm_map.setCenter(new OpenLayers.LonLat(lon, lat).transform(vis_coordinate_system, osm.projection), zoom); 
}
 
var selectedLinkList = []

function linkSelected(ev)
{
	var current_selection = $('#selected_links').val().split(',')
	for (var l in current_selection)
	    if (current_selection[l] == ev.feature.feature_id)
	    	return;
	
 	if ($('#selected_links').val() == '')
		$('#selected_links').val(ev.feature.feature_id)
	else
		$('#selected_links').val($('#selected_links').val() + ',' + ev.feature.feature_id)
	
	dataLayer_redraw()
}
 
function select_links_for_linkpaths()
{	
	$('#linkpath_view_options_selection').css('display', 'block');
	$('#linkpath_view_options_display').css('display', 'none');
	
	selecting_links_for_linkpaths = true;		
	theAnimator.Hide();
	document.getElementById('selected_links').value = ''
	enableSelection(linkSelected, null)
	$('#linkpath_view_options').show();
	dataLayer_redraw()
}

var linkpath_timestep_base;
var linkpath_timestep_interval;

function linkpath_timestep_label(t)
{
    return str(linkpath_timestep_base + t*linkpath_timestep_interval);
}

function receive_selected_link_paths(data)
{
	if (data['status'] != 'OK')
		error_dialog('Link path error: ' + data['status']);
	else
	{		
		linkpath_data = data;
		
		disableSelection();
		
		current_timestep = 0;
		number_of_timesteps = linkpath_data.timesteps.length;
		
		selecting_links_for_linkpaths = false;
		linkpath_attribute_selection();
		
		if (number_of_timesteps > 1)
		{
			theAnimator.SetTimeFrame(0, (number_of_timesteps-1)*data.interval);
			theAnimator.SetTimesteps(data.timesteps);
			theAnimator.Do(0);
		}
		else 
			dataLayer_redraw();
	}
}

function link_selection_done()
{	
	selecting_links_for_linkpaths = false;
	
	interval = $('#linkpath_view_options .aggregation_interval').val();
	method = $('[name=linkpath_aggregation_type]:checked').val();
	
	$.ajax({
		url: '/visualizer/load_link_paths/' + $('#linkpath_view_options .path_data_select').val() + '/' + interval + '/(' + $('#selected_links').val() + ')/' + method,
		dataType : 'json',
		cache: false,
		success: receive_selected_link_paths
		});
	
	$('#linkpath_view_options_display_dataset').html('Paths Dataset: ' + $('#linkpath_view_options .path_data_select').val())
	$('#linkpath_view_options_selection').css('display', 'none');
	$('#linkpath_view_options_display').css('display', 'block');
	
}

function OD_paths_node_selection_event(ev)
{	
    if (ev.feature.selectable)
    {
    	ev.feature.selectable = false;
		txt = $('#' + node_target_text)
		if (txt.val() == "")
			txt.val(ev.feature.feature_id)
		else
			txt.val(txt.val() + ',' + ev.feature.feature_id)
	}
}

var node_target_text = ''

function origin_destination_node_selected(ev)
{     
    if (ev.feature.selectable)
    {
    	ev.feature.selectable = false;
		txt = $('#' + node_target_text)
		if (txt.val() == "")
			txt.val(ev.feature.feature_id)
		else
			txt.val(txt.val() + ',' + ev.feature.feature_id)
		ev.feature.style.fillColor = '#00ff00';
		ev.feature.style.strokeColor = '#00ff00';
	}
}

function new_OD_paths_selection()
{
	number_of_timesteps = 1;	
	
	$('#OD_paths_origins').val('')
	$('#OD_paths_destinations').val('')
	
    $('#OD_paths_view_options .aggregation_interval').removeAttr("disabled");
    $('#OD_paths_view_options .path_data_select').removeAttr("disabled");
        
    $('#OD_paths_origin_selection_done_button').removeAttr('disabled')
    $('#OD_paths_origins').removeAttr("disabled");
    $('#OD_paths_destinations').attr("disabled", "disabled");

    number_of_timesteps = 1;
    OD_paths_origins = [];
    OD_paths_destinations = [];
    OD_paths_mode = 0;		
    select_OD_paths_nodes();
    
	$('#OD_paths_view_display').css('display', 'none');
	$('#OD_paths_view_selection').css('display', 'block');
	$('#OD_paths_view_options').show();
}

function select_OD_paths_nodes()
{	
	document.getElementById('OD_paths_origins').value = ''
	document.getElementById('OD_paths_destinations').value = ''
		
	OD_paths_origins			= []
	OD_paths_destinations		= []

	var dataset = $('#OD_paths_view_data_selector').val();
	load_OD_nodes(dataset, 1, receive_OD_nodes); 
	
 	node_target_text = 'OD_paths_origins'
	
	enableSelection(OD_paths_node_selection_event, function(e) { dataLayer_redraw(); });
}

function select_origin_destination_nodes()
{	
 	node_target_text = 'origin_destination_selection'
	enableSelection(origin_destination_node_selected, function(e) { dataLayer_redraw(); });
}

function origin_destination_origin_selection_clear()
{
	$('#origin_destination_selection').val('')
	dataLayer_redraw()
}

function OD_paths_origin_selection_done()
{
	if ($('#OD_paths_origins').val() == '')
	{
		alert("Gotta choose some origin nodes!")
	}
	else
	{
	    $('#OD_paths_origins').attr("disabled", "disabled");
	    $('#OD_paths_origin_selection_done_button').attr("disabled", "disabled");
	    $('#OD_paths_destinations').removeAttr("disabled");
	    load_OD_reached_nodes();
	}
}

function OD_paths_selection_ready()
{	
	if ($('#OD_paths_destinations').val() == '')
	{
		alert("Gotta choose some destination nodes!")
	}
	else
	{
		load_OD_paths();	
		disableSelection();
		$('#OD_paths_view_display').css('display', 'block');
		$('#OD_paths_view_selection').css('display', 'none');

	}
}
	
function OD_path_data_selected()
{
	$('#OD_paths_origins').val('')
	$('#OD_paths_origins').val('')
}
 
function resize_app()
{
/*
    var main_container = document.getElementById('main_container')
    var main_container_height = main_container.offsetHeight
    var main_container_width = main_container.offsetWidth
    
		box = document.getElementById('busroute_checkboxes');
		box.style.width = (main_container_width - 300) + 'px';
    
    var map = document.getElementById('map')
    var new_height = main_container_height - document.getElementById('control_row').offsetHeight
*/
    map.style.height = document.getElementById('main_container').offsetHeight + "px"
    map.style.width = document.getElementById('main_container').offsetWidth + "px"
    osm_map.updateSize()
}
  
function attribute_minmax(features, attr, types)
{
	var m =  Number.MAX_VALUE
    var M = -Number.MAX_VALUE
    
    var selected = [];  
    if (typeof(types) == 'undefined')
    	for (var i in features)
    		selected.push(features[i].feature_id);
    else
	    for (var i in features)
	    	if (types.indexOf(features[i].type) >= 0)
	    		selected.push(features[i].feature_id);
  
    for (var i in attr.data)
    {
    	dataVector = attr.data[i]
        for (var j in selected)
        {
        	var k = attr.id_map[selected[j]]
        	var d = dataVector[k]
        	if (d < m) 
        		m = d
        	if (d > M) 
        		M = d
        }
    }
    
    attr['range'] = [m,M]
}

function post_busroutes(routes)
{
	str = '';
	for (var rte in routes)
	{
	   str += '<div style="width:75px;height:20px;float:left;position:relative">'
	    str += '  <input type="checkbox" name="busroutes" class="busroute_checkbox" value="' + rte + '" checked="yes" onclick=dataLayer_redraw() >' + rte
	   str += '</div>'
	}
	
	document.getElementById('busroute_checkboxes').innerHTML = str;
}

function receive_network(data)
{
	if (data['status'] != 'OK') 
	{
		alert(data['status'])
		return;
	}

	if (data['timebase'])
	
	segmentList = data.segments;
	stopList = data.stops;
	tripList = data.trips;
	routeList = data.routes.sort(function(a,b) { return a[0] - b[0]; })
	
	if (tripList.length > 0)
	{
		var min = tripList[0].departure;
		var max = tripList[0].departure;
		for (var t in tripList)
		{
			d = tripList[t].departure;
			if (d < min) min = d;
			if (d > max) max = d;
		}
		   
	 	$('#transit_interval_minmax').html('(' + min + ',' + max + ')');
	 	$('#transit_interval_start').val(min);
	 	$('#transit_interval_end').val(max);
		   
	 	$('#transitOD_interval_minmax').html('(' + min + ',' + max + ')');
	 	$('#transitOD_interval_start').val(min);
	 	$('#transitOD_interval_end').val(max);
	}
	
	tmp_routeList = []
    for (var r in routeList)
    {
        rid = routeList[r][0];
        if (rid < 0) rid = -rid;
        if (tmp_routeList.indexOf(rid) == -1)
        	tmp_routeList.push(rid)
    }
	
    s = '';
    for (var r in tmp_routeList)
        s = s + '<option value=' + tmp_routeList[r] + '>' + tmp_routeList[r] + '</option>';
 
    $('#route_options').html(s)
    
	network_nodeid_to_index = {}
	
	min_lat =  999;
	max_lat = -999;
	min_lon =  999;
	max_lon = -999;
	
	for (var n in data.nodes)
	{
		node = data.nodes[n];
		node_features.push(create_node_feature(node[0], node[1], node[2]));
		if (node[2][0] < min_lon) min_lon = node[2][0];
		if (node[2][0] > max_lon) max_lon = node[2][0];
		if (node[2][1] < min_lat) min_lat = node[2][1];
		if (node[2][1] > max_lat) max_lat = node[2][1];
		network_nodeid_to_index[node[0]] = n;
	}

	dlon = max_lon - min_lon
	dlat = max_lat - min_lat
	d = Math.sqrt(dlon*dlon + dlat*dlat)
	
    	position_map((max_lon + min_lon) / 2.0, (max_lat + min_lat) / 2.0, d)

	for (var varname in data.nodeAttributes)
	{
		attribute = data.nodeAttributes[varname]
		attribute.id_map = network_nodeid_to_index
		attribute_minmax(node_features, attribute, [1])
		node_attributes[varname] = attribute
	}
	
	post_node_color_options("constant")
	post_node_size_options("constant")
	 
	network_linkid_to_index = {}
	
	for (var l in data.links)
	{
		link = data.links[l]
		
		link_features.push(create_link_feature(link[0], link[1], link[4], link[2], link[3], link[5], true))		
		transit_link_features.push(create_link_feature(link[0], link[1], link[4], link[2], link[3], link[5], false))		
		network_linkid_to_index[link[0]] = l;
	}

	for (var varname in data.linkAttributes)
	{
		attribute = data.linkAttributes[varname]
		attribute.id_map = network_linkid_to_index
		attribute_minmax(link_features, attribute, [1])
		link_attributes[varname] = attribute
		
	}
	
	busroutes = data.busroutes
	post_busroutes(busroutes)
	
	post_link_color_options("constant")		
	post_link_size_options("constant");
	
	loading_default_path_data = true;
	
	load_corridor_travel_times(data.name);

	theAnimator.set_datetime(data.time_base);
	
	underLayer_redraw();
}
	
function load_network()
{
	$.ajax({
		url: '/visualizer/load_network/' + network_name,
		dataType : 'json',
		cache: false,
		success: function(data) {
			receive_network(data);
		    },
		error: function() {
			alert('Failed to load network');
		    }
		});
}

function add_corridor_travel_time_dataset(name)
{	
	var e = document.getElementById('busroute_data_select')
    var s = e.innerHTML;
    s = '<option name=corridor_travel_time_option value="' + name + '">' + name + '</option>' + s;
    e.innerHTML = s;
	e.disabled = false;
}

function receive_corridor_travel_times(data)
{
	corridor_travel_times[data.name] = data;
	add_corridor_travel_time_dataset(data.name);
	dataLayer_redraw();
}
	
function load_corridor_travel_times(network)
{
	$.ajax({
		url: '/visualizer/load_corridor_travel_times/' + network,
		dataType : 'json',
		cache: false,
		success: receive_corridor_travel_times
		});
}

function get_current_timestep()
{
	return current_timestep;
}

var current_popup_feature = null;  

function popup(evt)
{
    if (current_popup_feature != null)
	    popdown(evt)

	if (popups_enabled == false)
		return;
		
	feature = evt.feature;
	
	var s;
	
	if (feature.featureType == FeatureType.LINK)
    {
        linkid = feature.feature_id;
        link = link_features[network_linkid_to_index[linkid]];
        
        s = "link " + linkid
        s = s + '<br>    source: ' + link.source;
        s = s + '<br>    dest: ' + link.destination;
        
		cts = get_current_timestep()

		for (var a in link_attributes)
        {
        	data = link_attributes[a].data
        	indx = link_attributes[a].id_map[linkid]
        	if (data.length == 1)
        		v = link_attributes[a].data[0][indx];
        	else
        		v = link_attributes[a].data[cts][indx];
            s = s + '<br>    ' + a + ": " + v;
        }
    }
    else if (feature.featureType == FeatureType.TRANSIT_OD)
    {            
	s = "node " + feature.feature_id;
    }       
    else if (feature.featureType == FeatureType.NODE)
    {            
        node = feature.feature_id;
		s = "node " + node + '<br>Lat: ' + feature.location[1] + ' Lon: ' + feature.location[0]
		cts = get_current_timestep()
		
        for (var a in node_attributes)
        {
        	data = node_attributes[a].data
        	indx = node_attributes[a].id_map[node]
        	if (data.length == 1)
        		v = node_attributes[a].data[0][indx];
        	else
        		v = node_attributes[a].data[cts][indx];
			s = s + '<br>    ' + a + ": " + v;
		}
    }       
    else if (feature.featureType == FeatureType.TRANSIT_LINK)
    {
    	s = 	'link';
    	s = s + '<br>    load: ' + feature.load;
    	s = s + '<br>    linkid: ' + feature.feature_id;
		s = s + '<br>    routes:'
		for (var i in feature.routes)
			s = s + ' ' + feature.routes[i];
    }
    else if (feature.featureType == FeatureType.TRANSIT_FEED)
    {
    	s = 	'feed link';
    	s = s + '<br>    linkid: ' + feature.feature_id;
    }
    else if (feature.featureType == FeatureType.TRANSIT_NODE)
    {
    	s = 	'node';
    	s = s + '<br>    boarding: ' + feature.boarding;
    	s = s + '<br>    alighting: ' + feature.alighting;
    	s = s + '<br>    nodeid: ' + feature.feature_id;
	s = s + '<br>    routes:'
	for (var i in feature.routes)
		s = s + ' ' + feature.routes[i];
    }
            
	var popup = new OpenLayers.Popup.FramedCloud("popup", 
					OpenLayers.LonLat.fromString(feature.popup_location.toShortString()),
					null,
                    "<div style='font-size:.8em'>" + s + "</div>",
                    null,
                    true
                );
	
    feature.popup = popup;
    osm_map.addPopup(popup);
    $(".olPopup").css('z-index', 2001)
    
	current_popup_feature = feature;

}

function popdown(evt)
{
	if (current_popup_feature != null)
	{
    	osm_map.removePopup(current_popup_feature.popup);
    	current_popup_feature.popup.destroy();
    	current_popup_feature.popup = null;
   		current_popup_feature = null;
   	}
}

function post_link_color_options(which)
{
	if (which == "" || which == "constant")
		s = '<option value="constant" selected>constant</option>';
	else
		s = '<option value="constant">constant</option>';
	
	for (var a in link_attributes)
	    if (a == which)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';
		
	document.getElementById('link_color_select').innerHTML = s;
}

function post_link_size_options(which)
{
	if (which == "" || which == "constant")
		s = '<option value="constant" selected>constant</option>';
	else
		s = '<option value="constant">constant</option>';
	
	for (var a in link_attributes)
	    if (a == which)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';
		
	document.getElementById('link_size_select').innerHTML = s;
}

function post_node_color_options(which)
{	
	if (which == "" || which == "constant")
		s = '<option value="constant" selected>constant</option>';
	else
		s = '<option value="constant">constant</option>';
	
	for (var a in node_attributes)
	    if (which == a)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';

	document.getElementById('node_color_select').innerHTML = s;
}

function post_node_size_options(which)
{	
	if (which == "" || which == "constant")
		s = '<option value="constant" selected>constant</option>';
	else
		s = '<option value="constant">constant</option>';
	
	for (var a in node_attributes)
	    if (which == a)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';

	document.getElementById('node_size_select').innerHTML = s;
}

function linkpath_attribute_selection()
{	
	s = '<option value="counts" selected>counts</option><option value="constant">constant</option>';
	
	for (var a in link_attributes)
		s = s + '<option value="' + a + '">' + a + '</option>';

	document.getElementById('linkpath_color_select').innerHTML = s;
	document.getElementById('linkpath_size_select').innerHTML = s;
	
	no_dataLayer_redraw = true;
	new_linkpath_color_selection(true);
	new_linkpath_size_selection(true);
	no_dataLayer_redraw = false;
	
	dataLayer_redraw;
}

function post_OD_paths_attribute_options()
{	
	s = '<option value="constant">constant</option><option value="count" selected>count</option>';

	document.getElementById('OD_paths_color_select').innerHTML = s;
	document.getElementById('OD_paths_size_select').innerHTML = s;
}

function post_origin_destination_attribute_options()
{	
	s = '<option value="constant">constant</option><option value="count" selected>count</option>';

	document.getElementById('origin_destination_color_select').innerHTML = s;
	document.getElementById('origin_destination_size_select').innerHTML = s;
}

function new_linkpath_color_selection()
{
	var a = $('#linkpath_color_select')
	var color_attr = a.val()
	if (color_attr == 'constant')
		link_color_constant  = true;
	else if (color_attr == 'counts')
		theLinkColorMapper.SetRange(linkpath_data.min, linkpath_data.max)
	else		
	{
		link_color_constant  = false;
		color_attr_range = link_attributes[color_attr].range;
		if (color_attr_range == undefined)
		{
			color_attr = link_attributes[color_attr];
			if (color_attr == undefined)
			{
				error_dialog('Unable to find selected color attribute');
				return;
			}
			color_attr_range = color_attr['range'];
		}
		theLinkColorMapper.SetRange(color_attr_range[0], color_attr_range[1]);
	}
		
	dataLayer_redraw();
}

function new_linkpath_size_selection()
{
	size_attr = $('#linkpath_size_select').val()
	if (size_attr == 'constant')
		link_size_constant  = true;
	else if (size_attr == 'counts')
		theLinkSizeMapper.SetRange(linkpath_data.min, linkpath_data.max)
	else
	{
		link_size_constant  = false;
		size_attr_range = link_attributes[size_attr].range;
		if (size_attr_range == undefined)
		{
			size_attr = link_attributes[size_attr];
			if (size_attr == undefined)
			{
				error_dialog('Unable to find selected size attribute');
				return;
			}
			size_attr_range = size_attr['range'];
		}
		theLinkSizeMapper.SetRange(size_attr_range[0], size_attr_range[1]);
	}
		
	
	dataLayer_redraw();
}

function new_OD_paths_size_selection()
{
	size_attr = $('#OD_paths_size_select').val()
	if (size_attr != 'constant')
	{
		link_size_constant  = false;
		theLinkSizeMapper.SetRange(0, OD_paths['max'])
	}
	else
		link_size_constant  = true;
	dataLayer_redraw();
}

function new_OD_paths_color_selection()
{
	color_attr = $('#OD_paths_color_select').val()
	if (color_attr != 'constant')
	{
		link_color_constant  = false;
		theLinkColorMapper.SetRange(0, OD_paths['max'])
	}
	else
		link_color_constant  = true;
	dataLayer_redraw();
}

function create_node_feature(id, type, location)
{
	geometry = new OpenLayers.Geometry.Point(location[0], location[1]).transform(vis_coordinate_system, osm.projection);
	feature = new OpenLayers.Feature.Vector(geometry, null, {
													fillColor: "#ff0000", 
													fillOpacity: 0.6,
													strokeColor: "#ff0000",
													strokeOpacity: 1,
													strokeWidth: 3,
													pointRadius: '4'
												});

	feature.location				= location;
  feature.popup_location 	= geometry;
	feature.feature_id			= id;
	feature.featureType			= FeatureType.NODE;
	feature.type	 					= type;
	feature.visible 				= false;
	feature.selectable		  = false;

	return feature;
}

function create_link_feature(id, type, path, src, dst, segments, offset)
{
	var feature_path;
	
	if (offset)
		feature_path = offset_path(path, latLon_scaling);
	else
		feature_path = path;
	
	pointArray = [];
	for (var p in feature_path)
	{
		try
		{
			pt = feature_path[p]
			g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
			pointArray.push(g); 
		} catch(e) {
			console.log('create_link_feature')
		}
	}
	
	linestring     = new OpenLayers.Geometry.LineString(pointArray);
	feature        = new OpenLayers.Feature.Vector(linestring, null, {
												strokeColor: "#ff0000",
												strokeOpacity: 1,
												strokeWidth: 2
											});
												
	p0 = path[ 0];
	p1 = path[path.length-1];
	p = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
	
	feature.popup_location = new OpenLayers.Geometry.Point(p[0], p[1]).transform(vis_coordinate_system, osm.projection);
	
	feature.feature_id 		= id;
	feature.featureType		= FeatureType.LINK;
	feature.type 			= type;
	feature.isOffset		= offset;
	feature.visible 		= false;
	feature.selectable 		= false;
	feature.source			= src;
	feature.destination		= dst;
	feature.segments		= segments;
	feature.path		    = path;
	
	return feature;
}

function color_feature(feature, color, opacity)
{
	if (feature != undefined)
	{
		if (feature.style == undefined)
			alert('error!');
			
		feature.style.strokeColor = color;
		feature.style.fillColor = color;
		feature.style.strokeOpacity = opacity
		feature.style.fillOpacity = 0.6 * opacity
		
	}
}

function size_feature(feature, size)
{
	if (feature != undefined)
	{
		if (feature.style == undefined)
			alert('here');
		feature.style.strokeWidth = size;
		feature.style.pointRadius = size;
	}
}

function color_features_constant(features, color, opacity)
{
	for (var i in features)
		color_feature(features[i], color, opacity);
}

function size_features(features, size)
{
	for (var i in features)
		size_feature(features[i], size);
}

function size_features_constant(features, size)
{
        for (var i in features)
                size_feature(features[i], size);
}

function color_features(features, map, ids, data, colormap)
{
	color_features_constant(features, '')
	for (var i in ids)
	{
		var id = ids[i];
	  	var mapped_id = map[id]
	  	var feature = features[mapped_id]
	  	if (feature.type == 1)
	  	{
	  		var value = data[i]
			color_feature(feature, colormap.Map(value), 1);
		}
		else
			color_feature(feature, "#000000", 1)
	}
}

function size_features_by_attribute(features, map, attribute, timestep)
{
	size_features(features, "2")
	
	vmin = attribute['range'][0]
	vmax = attribute['range'][1]
	  
	if (attribute.data.length == 1)
		timestep_data = attribute.data[0]
	else
		timestep_data = attribute.data[timestep]
		
	for (var i in attribute.ids)
	{
	  	var attr_id = attribute.ids[i]
	  	var mapped_id = map[attr_id]
	  	var feature = features[mapped_id]
	  	if (feature.type == 1)
	  	{
	  		var value = timestep_data[mapped_id]
			size_feature(feature, Math.floor(1 + 8*((value - vmin) / (vmax - vmin))));
		}
	}
}

function post_colormap_annotations()
{
	var table = document.createElement('table')
	
	if (!link_color_constant)
	{
		var row = document.createElement('tr');

		var col = document.createElement('td');
		col.innerHTML = "<label>Link Colormap:</label>";
		row.appendChild(col);
		
		col = document.createElement('td');
		col.appendChild(theLinkColorMapper.GetAnnotation()[0]);
		row.appendChild(col);

		table.appendChild(row)
	}
	
	if (!link_size_constant)
	{
		var row = document.createElement('tr');
		
		var col = document.createElement('td');
		col.innerHTML = "<label>Link Widthmap:</label>";
		row.appendChild(col);
		
		col = document.createElement('td');
		col.appendChild(theLinkSizeMapper.GetAnnotation()[0]);
		row.appendChild(col);

		table.appendChild(row)
	}
	
	if (! node_color_constant)
	{
		var row = document.createElement('tr');
		
		var col = document.createElement('td');
		col.innerHTML = "<label>Node Colormap:</label>";
		row.appendChild(col);
		
		col = document.createElement('td');
		col.appendChild(theNodeColorMapper.GetAnnotation()[0]);
		row.appendChild(col);

		table.appendChild(row)
	}
	
	if (!node_size_constant)
	{
		var row = document.createElement('tr');
		
		var col = document.createElement('td');
		col.innerHTML = "<label>Node Sizemap:</label>";
		row.appendChild(col);
		
		col = document.createElement('td');
		col.appendChild(theNodeSizeMapper.GetAnnotation()[0]);
		row.appendChild(col);

		table.appendChild(row)
	}

	if ((RT_view_mode > 0) && ($('#view_type').val() == "reachtime"))
	{
		var row = document.createElement('tr');
		
		var col = document.createElement('td');
		col.innerHTML = "<label>Contour Colormap:</label>";
		row.appendChild(col);
		
		col = document.createElement('td');
		col.appendChild(theContourColorMapper.GetAnnotation()[0]);
		row.appendChild(col);

		table.appendChild(row)

		row = document.createElement('tr');
		
		col = document.createElement('td');
		col.innerHTML = "<label>Contour Link Widthmap:</label>";
		row.appendChild(col);
		
		col = document.createElement('td');
		col.appendChild(theContourSizeMapper.GetAnnotation()[0]);
		row.appendChild(col);

		table.appendChild(row)
	}

	var cmaps = document.getElementById("ColorMapDiv");
	while (cmaps.firstChild)
		cmaps.removeChild(cmaps.firstChild);

	cmaps.appendChild(table);
}

function color_feature_by_attribute(feature, ids, data, cmap, op)
{
	var indx = ids.indexOf(feature.feature_id);
	var value = data[indx];
	var color = cmap.Map(value);
	color_feature(feature, color, op)
}

function size_feature_by_attribute(feature, ids, data, wmap)
{
	var value = data[ids.indexOf(feature.feature_id)];
	size_feature(feature, wmap.Map(value));
}

function style_features_network(visible_features)
{	
	var link_color_attribute, link_color_ids;
	var link_size_attribute, link_size_ids;
	var node_color_attribute, node_color_ids;
	var node_size_attribute, node_size_ids;		  
		  
	constant_link_color = $('#network_data_link_color').val()
	constant_link_width = $('#network_data_link_width').val()
	constant_link_opacity = $('#network_data_link_opacity').val()
	constant_node_color = $('#network_data_node_color').val()
	constant_node_radius = $('#network_data_node_radius').val()
	constant_node_opacity = $('#network_data_node_opacity').val()
	
	var attr_name = document.getElementById('link_color_select').value
	if (attr_name == 'constant')
		link_color_constant = true;
	else
	{
		link_color_constant = false;
		link_color_attribute = link_attributes[attr_name];
		link_color_ids = link_color_attribute.ids;
	}

	attr_name = document.getElementById('link_size_select').value
	if (attr_name == 'constant')
		link_size_constant = true;
	else
	{
		link_size_constant = false;
		link_size_attribute = link_attributes[attr_name];
		link_size_ids = link_size_attribute.ids;
	}

	
	var attr_name = document.getElementById('node_color_select').value
	if (attr_name == 'constant')
		node_color_constant = true;
	else
	{
		node_color_constant = false;
		node_color_attribute = node_attributes[attr_name];
		node_color_ids = node_color_attribute.ids;
	}

	attr_name = document.getElementById('node_size_select').value
	if (attr_name == 'constant')
		node_size_constant = true;
	else
	{
		node_size_constant = false;
		node_size_attribute = node_attributes[attr_name];
		node_size_ids = node_size_attribute.ids;
	}

	timestep = get_current_timestep();  
	
	var link_color_data, link_size_data, node_color_data, node_size_data;
	
	if (link_color_constant == false)
	{
		if (link_color_attribute.data.length == 1)
			link_color_data = link_color_attribute.data[0];
		else
			link_color_data = link_color_attribute.data[timestep];
	}
	
	if (link_size_constant == false)
	{
		if (link_size_attribute.data.length == 1)
			link_size_data = link_size_attribute.data[0];
		else
			link_size_data = link_size_attribute.data[timestep];
	}
	
	if (node_color_constant == false)
	{
		if (node_color_attribute.data.length == 1)
			node_color_data = node_color_attribute.data[0];
		else
			node_color_data = node_color_attribute.data[timestep];
	}
	
	if (node_size_constant == false)
	{
		if (node_size_attribute.data.length == 1)
			node_size_data = node_size_attribute.data[0];
		else
			node_size_data = node_size_attribute.data[timestep];
	}
	
	if (link_color_constant && link_size_constant)
	{
		for (var i in link_features)
		{
			f = link_features[i];
			f.style.display = 'show';
		}
	}
	else
	{
		for (var i in link_features)
		{
			f = link_features[i];
			f.style.display = 'none';
		}
		
		if (link_color_constant)
		{
			for (var i in link_size_ids)
			{
				value = link_size_data[i];				
				sz = theLinkSizeMapper.Map(value);
				if (sz != undefined)
				{
					id = link_size_ids[i];
					f = link_features[network_linkid_to_index[id]];
					size_feature(f, sz);
					f.style.display = 'show';
				}
			}
		}
		else if (link_size_constant)
		{
			for (var i in link_color_ids)
			{
				value = link_color_data[i];
				color = theLinkColorMapper.Map(value);
				if (color != undefined)
				{
					id = link_color_ids[i];
					f = link_features[network_linkid_to_index[id]];
					color_feature(f, color);
					f.style.display = 'show';
				}
			}
		}
		else
		{
			for (var i in link_size_ids)
			{
				id = link_size_ids[i];
				if (link_color_ids.indexOf(id) >= 0)
				{
					value = link_size_data[i];				
					sz = theLinkSizeMapper.Map(value);
					value = link_color_data[i];
					color = theLinkColorMapper.Map(value);			
					if (sz != undefined && color != undefined)
					{
						f = link_features[network_linkid_to_index[id]];
						size_feature(f, sz);
						color_feature(f, color);
						f.style.display = 'show';
					}
				}
			}
		}
	}
	
	for (var i in node_features)
	{
		f = node_features[i];
		color_feature(f, constant_node_color, constant_node_opacity);
		size_feature(f, constant_link_width);
	}
	
	if (node_color_constant && node_size_constant)
	{
		for (var i in node_features)
		{
			f = node_features[i];
			f.style.display = 'show';
		}
	}
	else
	{
		for (var i in node_features)
		{
			f = node_features[i];
			f.style.display = 'none';
		}
		
		if (node_color_constant)
		{
			for (var i in node_size_ids)
			{
				value = node_size_data[i];				
				sz = theNodeSizeMapper.Map(value);
				if (sz != undefined)
				{
					id = node_size_ids[i];
					f = node_features[network_nodeid_to_index[id]];
					size_feature(f, sz);
					f.style.display = 'show';
				}
			}
		}
		else if (node_size_constant)
		{
			for (var i in node_color_ids)
			{
				value = node_color_data[i];
				color = theNodeColorMapper.Map(value);
				if (color != undefined)
				{
					id = node_color_ids[i];
					f = node_features[network_nodeid_to_index[id]];
					color_feature(f, color);
					f.style.display = 'show';
				}
			}
		}
		else
		{
			for (var i in node_size_ids)
			{
				id = node_size_ids[i];
				if (node_color_ids.indexOf(id) >= 0)
				{
					value = node_size_data[i];				
					sz = theNodeSizeMapper.Map(value);
					value = node_color_data[i];
					color = theNodeColorMapper.Map(value);			
					if (sz != undefined && color != undefined)
					{
						f = node_features[network_nodeid_to_index[id]];
						size_feature(f, sz);
						color_feature(f, color);
						f.style.display = 'show';
					}
				}
			}
		}
	}
}

function style_features_busroute(visible_features)
{	
	var selected_busroutes = $('#busroute_checkboxes .busroute_checkbox:checked');
	
	link_color_constant = false;
	link_size_constant = false;
	
	if (selected_busroutes.length > 0)
	{
		var dataset_name  = $('#busroute_data_select').val();
		var dataset       = corridor_travel_times[dataset_name];
		var timestep      = dataset.data[get_current_timestep()];
		var value, color;
	    
		for (var route in timestep)
		{
		    checked_busroutes = [];

		    $(".busroute_checkbox:checked").each(function() {checked_busroutes.push(this.value);})
		    
		    if ($.inArray(route, checked_busroutes))
			{
				value = timestep[route]
				
				if (value == -1)
				{
					size = 1;
					color = "#000000";
				}
				else
				{
					color = theLinkColorMapper.Map(value);
					size  = theLinkSizeMapper.Map(value);
				}
				
				links = busroutes[route];
				for (var l in links)
				{	
					var feature = link_features[network_linkid_to_index[links[l]]];
					if ((color == undefined) || (size == undefined))
						feature.style.display = 'none';
					else
					{
						color_feature(feature, color, 1);
						size_feature(feature, size);
					}
				}				
			}
		}
	}
}

function style_features_linkpaths(visible_features)
{
    if (selecting_links_for_linkpaths == true)
    {
        color_features_constant(link_features, "#ff0000", 1);
        size_features_constant(link_features, 2);
        
        var selected_links = $('#selected_links').val()
        if (selected_links != "")
        {
        	links = selected_links.split(',')
        	for (var i in links)
        	{
        		var link = links[i];
        		var mapped_link = network_linkid_to_index[link];
        		f = link_features[mapped_link];
        		f.style.strokeColor = '#00ff00';
        	}
        }
        return;
    }
     
    var timestep;
    if (number_of_timesteps > 1)
		timestep = linkpath_data.data[get_current_timestep()];
	else
		timestep = linkpath_data.data[0];
		
	color_attr_name = $('#linkpath_color_select').val()
	if (color_attr_name == undefined) 
		color_attr_name = 'constant';

	if (color_attr_name == 'counts')
	{
		link_color_constant = false;
		for (var i in timestep)
		{
			//linkid = timestep[i].linkid;
			// value = timestep[i].value;
			linkid = i;
			value = timestep[i];
			
			f = link_features[network_linkid_to_index[linkid]];
			color = theLinkColorMapper.Map(value);
			if (color == undefined)
				f.style.display = 'none'
			else
				color_feature(f, color, 1);				
		}
	}
	else if (color_attr_name != 'constant')
	{
		link_color_constant = false;
		
		color_attr = link_attributes[color_attr_name];
		color_data = color_attr.data[0];

		for (var i in timestep)
		{
			//linkid = timestep[i].linkid;
			linkid = i;
			
			linkid = timestep[i].linkid;
			mapped_linkid = network_linkid_to_index[linkid];
			f = link_features[mapped_linkid];
			value = color_data[mapped_linkid];
			color = theLinkColorMapper.Map(value);
			if (color == undefined)
				f.style.display = 'none'
			else
				color_feature(f, color, 1);
		}
	}			
		
	size_attr_name = $('#linkpath_size_select').val()
	if (size_attr_name == undefined) 
		size_attr_name = 'constant';
		
	if (size_attr_name == 'constant')
	{
	    link_size_constant = true;
		size_features_constant(link_features)
	}
	else if (size_attr_name == 'counts')
	{
		link_size_constant = false;
		for (var i in timestep)
		{
			//linkid = timestep[i].linkid;
			// value = timestep[i].value;
			linkid = i;
			value = timestep[i];
			
			mapped_linkid = network_linkid_to_index[linkid];
			f = link_features[mapped_linkid];
			sz = theLinkSizeMapper.Map(value);
			if (sz == undefined)
				f.style.display = 'none'
			else
				size_feature(f, sz);
		}
	}
	else 
	{
		
		size_attr = link_attributes[size_attr_name];
		size_data = size_attr.data[0];

		link_size_constant = false;
		for (var i in timestep)
		{
			//linkid = timestep[i].linkid;
			linkid = i;
			
			mapped_linkid = network_linkid_to_index[linkid];
			value = size_data[mapped_linkid];
			f = link_features[mapped_linkid];
			sz = theLinkSizeMapper.Map(value);
			if (sz == undefined)
				f.style.display = 'none'
			else
				size_feature(f, sz);
		}
	}
	
    selected_links = $('#selected_links').val()
	links = selected_links.split(',')
	for (var i in links)
	{
		var link = links[i];
		var mapped_link = network_linkid_to_index[link];
		f = link_features[mapped_link];
		size_feature(f, 1);
		f.style.strokeDashstyle = 'dot';
		f.style.display = 'display';
		f.style.strokeWidth = 2;
	}
}

function style_features_OD_paths(visible_features)
{	
	if (OD_paths_mode == 0)
	{	
		for (var i in OD_paths_origins)
		{
			f = node_features[network_nodeid_to_index[OD_paths_origins[i]]];
			f.style.strokeOpacity = 1;
			f.style.fillOpacity = 0.6;
		}
    }
	else if (OD_paths_mode == 1)
	{	
		for (var i in OD_paths_destinations)
		{
			f = node_features[network_nodeid_to_index[OD_paths_destinations[i]]];
			f.style.strokeOpacity = 1;
			f.style.fillOpacity = 0.6;
		}
    }
    else
	{	
		if (OD_paths['number_of_timesteps'] == 1)
			timestep = OD_paths['data'][0]
		else
			timestep = OD_paths['data'][get_current_timestep()];

		color_attr = $('#OD_paths_color_select').val()
		if (color_attr == undefined) 
			color_attr = 'constant';

		if (color_attr == 'constant')
		{
			link_color_constant = true;
			color_features_constant(link_features, 1);
		}
		else 
		{
			link_color_constant = false;
			for (var l in timestep)
			{
				linkid = timestep[l][0];
				value = timestep[l][1];
				f = link_features[network_linkid_to_index[linkid]];
				color = theLinkColorMapper.Map(value);
				if (color == undefined)
					f.style.display = 'none';
				else
					color_feature(f, color, 1);		
			}
		}
	
		size_attr = $('#OD_paths_size_select').val()
		if (size_attr == undefined) 
			size_attr = 'constant';
			
		if (size_attr == 'constant')
		{
		    link_size_constant = true;
			size_features_constant(link_features)
		}
		else 
		{
			link_size_constant = false;
			for (var l in timestep)
			{
				linkid = timestep[l][0];
				value = timestep[l][1];
				f = link_features[network_linkid_to_index[linkid]];
				sz = theLinkSizeMapper.Map(value);
				if (sz == undefined)
					f.style.display = 'none';
				else
					size_feature(f, sz)
			}
		}
	}
	
	nodes = $('#OD_paths_origins').val()
	if (nodes != '')
	{
		nodes = nodes.split(',');
		for (var i in nodes)
		{
			node = nodes[i]
			mapped_node = network_nodeid_to_index[node]
			feature = node_features[mapped_node]
			feature.style.strokeWidth = 1;
			feature.style.strokeColor = "#00ff00";
			feature.style.fillColor = "#00ff00";
		}
	}

	nodes = $('#OD_paths_destinations').val()
	if (nodes != '')
	{
		nodes = nodes.split(',');
		for (var i in nodes)
		{
			node = nodes[i]
			mapped_node = network_nodeid_to_index[node]
			feature = node_features[mapped_node]
			feature.style.strokeColor = "#ff00ff";
			if (feature.style.fillColor != '#00ff00')
			{
				feature.style.strokeWidth = 1;
				feature.style.fillColor = "#ff00ff";
			}
		}
	}
}

function style_features_origin_destination(visible_features)
{		
	if (origin_destination_mode == 0)
	{
		tmp = []
		for (var i in origin_destination_nodes)
			tmp.push(node_features[network_nodeid_to_index[origin_destination_nodes[i]]]);
		
		color_features_constant(tmp, '#ff0000', 1);
		
		nodelist = []
		nodeids = $('#origin_destination_selection').val().split(',')
		for (var i in nodeids)
			nodelist.push(node_features[network_nodeid_to_index[nodeids[i]]]);
		
		color_features_constant(nodelist, '#00ff00', 1);
	}
	else
	{
		color_attr = $('#origin_destination_color_select').val()
		if (color_attr == undefined) 
			color_attr = 'constant';

	    // nodelist is going to be a timestep associative array if
	    // either color or size is non-constant. Doesn't matter which.
		var nodelist = ''
		
		if (color_attr == 'constant')
		{
	    	node_color_constant = true;
		}
		else 
		{
			node_color_constant = false;
			
			if (number_of_timesteps == 1)
				color_data = OD_distribution_tsteps[0]
			else
				color_data = OD_distribution_tsteps[get_current_timestep()];
			
			nodelist = color_data;
		}
	
		size_attr = $('#origin_destination_size_select').val()
		if (size_attr == undefined) 
			size_attr = 'constant';
			
		if (size_attr == 'constant')
		{
		    node_size_constant = true;
			size_features_constant(visible_features)
		}
		else 
		{
			node_size_constant = false;
			
			if (number_of_timesteps == 1)
				size_data = OD_distribution_tsteps[0]
			else
				size_data = OD_distribution_tsteps[get_current_timestep()];
			
			nodelist = size_data
		}	
		
		if (nodelist != '')
		{			
		    for (var i in nodelist)
		    {
		    	var nodeid = nodelist[i].nodeid;
		    	var mapped_nodeid = network_nodeid_to_index[nodeid];
		    	var feature = node_features[mapped_nodeid];
		    	var value = nodelist[i].count;

		    	if (node_color_constant || node_size_constant)
		    	{
		    		feature.style.strokeOpacity = 1
		    		feature.style.fillOpacity = 0.6;
		    	}
		    	
		    	if (! node_color_constant)
		    	{
		    		var color = theNodeColorMapper.Map(value);
		    		if (color == undefined)
		    			feature.style.display = 'none';
		    		else
		    			color_feature(feature, color, 1);
				}
				
		    	if (! node_size_constant)
		    	{
		    		var radius = theNodeSizeMapper.Map(value);
		    		if (radius == undefined)
		    			feature.style.display = 'none';
		    		else
		    			size_feature(feature, radius);
		    	}
			}
		}
	}
}

function style_features_reachtime(visible_features)
{
	link_color_constant = true;
	link_size_constant  = true;
	node_color_constant = true;
	node_size_constant  = true;

	if (RT_view_mode == 0)
	{
		nodeids = $('#RT_origin_nodes').val().split(',');
		for (var i in nodeids)
		{
			f = node_features[network_nodeid_to_index[nodeids[i]]];
			color_feature(f, '#00ff00', 1)
		}
	}
	else
	{
		if ($('#RT_show_links').prop('checked') && RT_data['data'].length > 0) 
		{
	    	var timestep = RT_data['data'][get_current_timestep()];
	    	var wdata = timestep['link_counts']
	    	for (var linkid in wdata)
    		{
	    		link = link_features[network_linkid_to_index[linkid]];
	    		if (link != undefined)
    			{
		    		sz = theContourSizeMapper.Map(wdata[linkid]);
		    		if (sz == undefined)
		    			link.style.display = 'none';
		    		else
		    			size_feature(link, sz);	    			
    			}
    		}
	    	var cdata = timestep['contour_links']
	    	for (var linkid in cdata)
	    	{
	    		link = link_features[network_linkid_to_index[linkid]];
	    		if (link != undefined)
	    		{
					color = theContourColorMapper.Map(cdata[linkid]);
		    		if (color == undefined)
		    			link.style.display = 'none';
		    		else
		    			color_feature(link, color, 1);
			   	}    
	    	}
		}	
	}
}
 
function style_features(visible_features)
{	
	view = 	$('#view_type').val();
	
	if (view == 'network_data')
		style_features_network(visible_features);
	else if (view == 'linkpaths')
		style_features_linkpaths(visible_features);
	else if (view == 'busroute')
		style_features_busroute(visible_features);
	else if (view == 'OD_paths')
		style_features_OD_paths(visible_features);
	else if (view == 'origin_destination')
		style_features_origin_destination(visible_features);
	else if (view == 'reachtime')
		style_features_reachtime(visible_features);
}

function network_attribute_selection()
{	
	$('#node_link_view_options').show();
	
	var timesteps = [0];
	
	var link_color_timesteps = [];
	var link_size_timesteps  = [];
	var node_color_timesteps = [];
	var node_size_timesteps  = [];
	
	var attr_name = document.getElementById('link_color_select').value
	if (attr_name == 'constant')
		link_color_constant = true;
	else
	{
		link_color_constant = false;
		link_color_attribute = link_attributes[attr_name];
		
		var range = link_color_attribute['range'];
		theLinkColorMapper.SetRange(range[0], range[1]);
		theLinkColorMapper.SetUnits(link_color_attribute.units)
		
		link_color_timesteps = link_color_attribute.timesteps;
	}

	attr_name = document.getElementById('link_size_select').value
	if (attr_name == 'constant')
		link_size_constant = true;
	else
	{
		link_size_constant = false;
		link_size_attribute = link_attributes[attr_name];

		var range = link_size_attribute['range'];
		theLinkSizeMapper.SetRange(range[0], range[1]);
		theLinkSizeMapper.SetUnits(link_size_attribute.units)
		
		link_size_timesteps = link_size_attribute.timesteps;
	}

	
	var attr_name = document.getElementById('node_color_select').value
	if (attr_name == 'constant')
		node_color_constant = true;
	else
	{
		node_color_constant = false;
		node_color_attribute = node_attributes[attr_name];
 
		var range = node_color_attribute['range'];
		theNodeColorMapper.SetRange(range[0], range[1]);
		
		node_color_timesteps = node_color_attribute.timesteps;
	}

	attr_name = document.getElementById('node_size_select').value
	if (attr_name == 'constant')
		node_size_constant = true;
	else
	{
		node_size_constant = false;
		node_size_attribute = node_attributes[attr_name];

		var range = node_size_attribute['range'];
		theNodeSizeMapper.SetRange(range[0], range[1]);
		
		node_color_timesteps = node_color_attribute.timesteps;
	}

	current_timestep = 0;
	
	if ((timesteps.length == 0) || (link_color_timesteps.length > 1))
		if ((timesteps.length == 0) && (timesteps.lengths != link_color_timesteps.length))
		{
			alert('timestep mismatch')
			return;
		}
		else 
			timesteps = link_color_timesteps;
			
	if ((timesteps.length == 0) || (link_size_timesteps.length > 1))
		if ((timesteps.length == 0) && (timesteps.lengths != link_size_timesteps.length))
		{
			alert('timestep mismatch')
			return;
		}
		else 
			timesteps = link_size_timesteps;
	
	if ((timesteps.length == 0) || (node_color_timesteps.length > 1))
		if ((timesteps.length == 0) && (timesteps.lengths != node_color_timesteps.length))
		{
			alert('timestep mismatch')
			return;
		}
		else 
			timesteps = node_color_timesteps;
			
	if ((timesteps.length == 0) || (node_size_timesteps.length > 1))
		if ((timesteps.length == 0) && (timesteps.lengths != node_size_timesteps.length))
		{
			alert('timestep mismatch')
			return;
		}
		else 
			timesteps = node_size_timesteps;
	
	number_of_timesteps = timesteps.length;
	if (number_of_timesteps > 1)
	{
		theAnimator.SetTimesteps(timesteps);
		theAnimator.Do(0);
	}
	else	
	{	
		theAnimator.Hide();
		dataLayer_redraw();
	}
}

function link_color_selection()
{
	selected_attribute_name = document.getElementById('link_color_select').value;
	
	if (selected_attribute_name == 'constant')
		number_of_timesteps = 1
	else 
	{
		number_of_timesteps = link_attributes[selected_attribute_name].timesteps.length;
		var range = link_attributes[selected_attribute_name]['range'];
		theLinkColorMapper.SetRange(range[0], range[1]);
	}
				
	if (number_of_timesteps > 1)
		theAnimator.SetSteps(number_of_timesteps);

	render_timestep(0)
}

function reset_features()
{
    dataLayer.removeAllFeatures();

    var link_color    = $("#network_data_link_color").val()
    var link_width    = $("#network_data_link_width").val()
    var link_opacity  = $("#network_data_link_opacity").val()
    var node_color    = $("#network_data_node_color").val()
    var node_radius   = $("#network_data_node_radius").val()
    var node_opacity  = $("#network_data_node_opacity").val()
    
    for (var i in link_features)
    {
    	f = link_features[i];
    	f.visible = false;
    	f.selectable = false;
    	f.style.strokeColor = link_color;
    	f.style.strokeWidth = link_width;
    	f.style.strokeDashstyle = 'solid'
    	f.style.strokeOpacity = link_opacity;
    	f.style.display = 'show';
    	f.attributes.zIndex = base_z;
    	f.style.graphicZIndex = base_z;
    }
	for (var i in link_features)
    {
    	f = link_features[i];
    	f.visible = false;
    	f.selectable = false;
    	f.style.strokeColor = link_color;
    	f.style.strokeWidth = link_width;
    	f.style.strokeDashstyle = 'solid'
        f.style.strokeOpacity = link_opacity;
    	f.style.display = 'show'
        f.attributes.zIndex = base_z;
    	f.style.graphicZIndex = base_z;
   }
	for (var i in node_features)
    {
    	f = node_features[i];
    	f.visible = false;
    	f.selectable = false;
    	f.style.fillColor = node_color;
    	f.style.strokeColor = node_color;
    	f.style.strokeWidth = 0.6 * node_radius;
    	f.style.pointRadius = node_radius;
       	f.style.strokeOpacity = node_opacity;
       	f.style.fillOpacity = 0.6*node_opacity;
    	f.style.display = 'show'
        f.attributes.zIndex = base_z;
    	f.style.graphicZIndex = base_z;
   }
}

function dataLayer_redraw()
{	
	if (no_dataLayer_redraw)
		return;
	
	popdown()
	reset_features()
	features = []
	
	node_color_constant	= true;
	node_size_constant 	= true;
	link_color_constant = true;
	link_size_constant 	= true;


	if ($('#view_type').val() == 'linkpaths')
	{		
	 	if (selecting_links_for_linkpaths)
 		{
			var capacities = link_attributes['capacity']['data'][0];
			var min_cap = $('#linkpath_capacity_level').val();
			var show_connectors = $("#linkpath_selection_include_connectors").is(':checked')
			
	 		for (var i in link_features)
	 	    {
	 	    	var f = link_features[i];
	 	    	var cap = capacities[network_linkid_to_index[f.feature_id]];
	 	    	
	 	    	if (((f.type == '1') || show_connectors) && (cap > min_cap))
	 	    	{
		 	    	f.selectable = true;
		 	    	features.push(f);
	 	    	}
	 	    }
 		}
	 	else
	 	{
			if (linkpath_data != undefined && linkpath_data.timesteps.length > 0)
			{				
				var show_connectors = $("#linkpath_display_include_connectors").is(':checked')
				
				if (linkpath_data.timesteps.length == 1)
					links = linkpath_data.data[0];
				else 
					links = linkpath_data.data[get_current_timestep()];
	
				for (var i in links)
				{
					mapped_linkid = network_linkid_to_index[i];
					f = link_features[mapped_linkid];
					if (typeof f == 'undefined')
						alert('undefined feature')
					else if (((f.type  == '1') || show_connectors) && (f.visible == false))
					{
						f.visible = true;
						features.push(f);
					}
				}
			}
		}
	}
	else if ($('#view_type').val() == "network_data")
	{	
		var capacities = link_attributes['capacity']['data'][0];
		var min_capacity = $('#network_data_cap_min').val();
		var max_capacity = $('#network_data_cap_max').val();
		
		if (max_capacity == 'max') 
			max_capacity = 9999999;
		
		var checkedNodeTypes = {};
		if ($("#network_data_show_regular_nodes").is(':checked')) 
			checkedNodeTypes["1"] = 1;
		if ($("#network_data_show_centroid_nodes").is(':checked')) 
			checkedNodeTypes["100"] = 1;
	 
		var checkedLinkTypes = {}
		if ($("#network_data_show_regular_links").is(':checked')) 
			checkedLinkTypes["1"] = 1;
		if ($("#network_data_show_centroid_links").is(':checked')) 
			checkedLinkTypes["100"] = 1;

 		for (var i in link_features)
 	    {
 	    	f = link_features[i];
 	    	cap = capacities[i]
 	    	if ((f.type in checkedLinkTypes) && (cap >= min_capacity) && (cap <= max_capacity))
 	    	{
	 	    	f.selectable = true;
	 	    	features.push(f)
 	    	}
 	    }
 		
 		for (var i in node_features)
 	    {
 	    	f = node_features[i];
 	    	if (f.type in checkedNodeTypes)
 	    	{
 	    		f.selectable = true;
 	    		features.push(f)
 	    	}
 	    }

	}	
	else if ($('#view_type').val() == "busroute")
	{	
        var selected_busroutes = $('#busroute_checkboxes .busroute_checkbox:checked');
        var dataset_name = $('#busroute_data_select').val();
        var dataset = corridor_travel_times[dataset_name];
        var timestep = get_current_timestep();
        
        selected_busroutes.each(function (i,e)
									{
        		       					var route = e.value;
        		       					var links = busroutes[route];
        								for (var l in links)
        								{
        									f = link_features[network_linkid_to_index[links[l]]];
        									if (! f.visible)
        									{
    											f.visible = true;
    											features.push(f);
         									}
        								}
									});
	} 
	else if ($('#view_type').val() == "OD_paths")
	{	
		nodes = $('#OD_paths_origins').val()
		if (nodes != '')
		{
			nodes = nodes.split(',');
			for (var i in nodes)
			{
				f = node_features[network_nodeid_to_index[nodes[i]]];
				if (! f.visible)
				{
					f.visible = true;
					features.push(f);
				}
			}
		}

		nodes = $('#OD_paths_destinations').val()
		if (nodes != '')
		{
			nodes = nodes.split(',');
			for (var i in nodes)
			{
				f = node_features[network_nodeid_to_index[nodes[i]]];
				if (! f.visible)
				{
					f.visible = true;
					features.push(f);
				}
			}
		}

		if (OD_paths_mode == 0)
		{	
			for (var i in OD_paths_origins)
			{
				f = node_features[network_nodeid_to_index[OD_paths_origins[i]]];
				f.selectable = true;
				if (! f.visible)
				{
					f.visible = true;
					features.push(f);
				}
			}
	    }
		else if (OD_paths_mode == 1)
		{	
			for (var i in OD_paths_destinations)
			{
				f = node_features[network_nodeid_to_index[OD_paths_destinations[i]]];
				f.selectable = true;
				if (! f.visible)
				{
					f.visible = true;
					features.push(f);
				}
			}
	    }
	    else
	    {
	    	links = OD_paths['data'][get_current_timestep()];
	    	for (var l in links)
	    	{
	    		linkid = links[l][0]
	    		link_indx= network_linkid_to_index[linkid]
	    		if (link_indx != undefined)
	    		{
	    			f = link_features[link_indx];
	    			if (! f.visible)
	    			{
	    				f.visible = true;
	    				features.push(f);
	    			}
	    		}
  	  		}
	    }
	}
	else if ($('#view_type').val() == "origin_destination")
	{	
		if (origin_destination_mode == 0)
		{	
			for (var i in origin_destination_nodes)
			{
				f = node_features[network_nodeid_to_index[origin_destination_nodes[i]]];
				f.selectable = true;
				if (! f.visible)
				{
					f.visible = true;
					features.push(f);
				}
			}
	    }
	    else
	    {
	    	var node_data = OD_distribution_tsteps[get_current_timestep()];
	    	for (var i in node_data)
	    	{
	    		nodeid = node_data[i].nodeid;
	    		node_indx = network_nodeid_to_index[nodeid]
	    		if (node_indx != undefined)
	    		{
	    			f = node_features[node_indx];
	    			if (! f.visible)
	    			{
	    				f.visible = true;
	    				features.push(f);
	    			}
	    		}
			}    	
  	  	}
	}
	else if ($('#view_type').val() == "reachtime")
	{	 
		link_color_constant = true
		link_size_constant = true
		
		if (RT_view_mode == 0)
		{
			for (var i in RT_origin_nodes)
			{
				f = node_features[network_nodeid_to_index[RT_origin_nodes[i]]];
				f.selectable = true;
				if (! f.visible)
				{
					f.visible = true;
					f.style.strokeOpacity = 1;
					f.style.fillOpacity = 0.6;
					features.push(f);
				}
			}
		}
		else
		{
			link_color_constant = false
			link_size_constant = false
			
			if ($('#RT_show_origins').prop('checked'))
			{
				origins = $('#RT_origin_nodes').val().split(',')
				for (var i in origins)
				{
					o = origins[i];
					mapped_o = network_nodeid_to_index[o];
					f = node_features[mapped_o];
					if (! f.visible)
					{
						f.visible = true;
						f.style.strokeOpacity = 1;
						f.style.fillOpacity = 0.6;
						features.push(f);
					}
				}
			}

			timestep = get_current_timestep()
			
			if (RT_data['data'].length > timestep)
			{
				if ($('#RT_show_links').prop('checked'))
				{
					var linkdata = RT_data['data'][timestep]['link_counts'];
					for (var linkid in linkdata) 
					{
			    		link_indx = network_linkid_to_index[linkid]
			    		if (link_indx != undefined)
			    		{
			    			f = link_features[link_indx];
			    			if (! f.visible)
			    			{
			    				f.visible = true;
								f.style.graphicZIndex = path_z;
     		    				f.attributes.zIndex = path_z;
			    				features.push(f);
			    			}
			    		}
					}		
				}
				
				if ($('#RT_show_contours').prop('checked'))
				{	
					var contourOpacity = $('#RT_contour_opacity').val()

					var contours = RT_data['data'][timestep]['contours'];
					var rings = [];
					var colors = []
					for (var c in contours)
					{
						contour = contours[c];
						polygon = contour['polygon']
						color = theContourColorMapper.Map(c)
										
						pointArray = [];
						for (var p in polygon)
						{
							try
							{
								pt = polygon[p]
								g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
								pointArray.push(g); 
							} 
							catch(e) 
							{
								console.log('error creating contour geometry')
							}
						}
						if (pointArray.length > 2)
							rings.push([pointArray, color])
					}
					
					if (contourOpacity == 0.0)
					{	
						for (var r in rings)
						{
							ring = rings[r]
							linestring     = new OpenLayers.Geometry.LineString(ring[0]);
							feature        = new OpenLayers.Feature.Vector(linestring, null, {
																	strokeColor: ring[1],
																	strokeOpacity: 1,
																	strokeWidth: 2
																});
							
							feature.style.graphicZIndex = contour_z;
							feature.attributes.zIndex = contour_z;
							features.push(feature)
						}
					}
					else
					{
						for (var r in rings)
							rings[r][0] = new OpenLayers.Geometry.LinearRing(rings[r][0]);
						
						for (var r in rings)
						{
							if (r == 0)
								contours = [rings[0][0]]
							else
								contours = [rings[r][0], rings[r-1][0]]
							
							feature        = new OpenLayers.Feature.Vector(
														new OpenLayers.Geometry.Polygon(contours), null, {
																		strokeColor: rings[r][1],
																		strokeOpacity: contourOpacity,
																		strokeWidth: 2,
																		fillColor: rings[r][1],
																		fillOpacity: contourOpacity
																	});
							
							feature.style.graphicZIndex = contour_z;
							feature.attributes.zIndex = contour_z;
							features.push(feature);		
						}
						
					}
				}
				
				if ($('#RT_show_locations').prop('checked'))
				{					
					var contours = RT_data['data'][timestep]['contours'];
					for (var c in contours)
					{
						color = fixed_colors[c % fixed_colors.length]
						
						contour = contours[c];
						points = contour['points']
						
						pointArray = [];
						for (var p in points)
						{
							try
							{
								pt = points[p];
								g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
								f = new OpenLayers.Feature.Vector(g, null, {
																				fillColor: color,
																				fillOpacity: 0.6,
																				strokeColor: color,
																				strokeOpacity: 1,
																				strokeWidth: 1,
																				pointRadius: 2
																			});
	
	
								features.push(f); 
							} 
							catch(e) 
							{
								console.log('error creating contour geometry')
							}
						}
			
					}
				}
			}
		}
	}
	else if ($('#view_type').val() == "transit")
	{
		// TRANSIT
		if (transit_data != 0 && transit_data['node_attr_data']['nodeids'].length > 0 && transit_data['link_attr_data']['linkids'].length > 0)
		{
			var ba_data;

			var routeOptions = $('#route_options').options;
			routeKnt = -1;
				
			do_dir = [($("#transit_0").is(':checked')), ($("#transit_1").is(':checked'))];

			do_links = $("#transit_show_links").is(':checked');
			do_stops = $("#transit_show_stops").is(':checked');
			do_feeds = $("#transit_show_feeds").is(':checked');

			start = $('#transit_interval_start').val();
			end   = $('#transit_interval_end').val();

			var node_attr_ids = transit_data['node_attr_data']['nodeids'];
			var node_attr_color_data, node_attr_size_data, show_nodes_by_attr = $('input[name="transit_stops_by"]:checked').val() == 'attr';

			if (show_nodes_by_attr) 
		  {
				node_attr_color_data = transit_data['node_attr_data'][$('#transit_node_color_attr').val()][$('#transit_node_color_show').val()];
				node_attr_size_data = transit_data['node_attr_data'][$('#transit_node_size_attr').val()][$('#transit_node_size_show').val()];

				mm = node_attr_color_data.reduce(function (p, v) { return ( p < v ? p : v ) });
				MM = node_attr_color_data.reduce(function (p, v) { return ( p > v ? p : v ) });
				theNodeColorMapper.SetRange(mm, MM);

				mm = node_attr_size_data.reduce(function (p, v) { return ( p < v ? p : v ) });
				MM = node_attr_size_data.reduce(function (p, v) { return ( p > v ? p : v ) });
				theNodeSizeMapper.SetRange(mm, MM);

				node_color_constant = false;
				node_size_constant = false;
			}
			else
			{
				var mm = 9999999;
				var MM = 0;

				var b = transit_data['node_attr_data']['boarding']['tot'];
				var a = transit_data['node_attr_data']['alighting']['tot'];
				for (var i in b)
				{	
					v = a[i] + b[i];
					if (v < mm) mm = v;
					if (v > MM) MM = v;
				}
				theNodeSizeMapper.SetRange(mm, MM)
				node_color_constant = true;
				node_size_constant = false;
			}

			var link_attr_id, link_attr_color_data, link_attr_size_data;

			link_attr_ids = transit_data['link_attr_data']['linkids'];
			link_attr_color_data = transit_data['link_attr_data'][$('#transit_link_color_attr').val()][$('#transit_link_color_show').val()];
			link_attr_size_data = transit_data['link_attr_data'][$('#transit_link_size_attr').val()][$('#transit_link_size_show').val()];

			mm = link_attr_color_data.reduce(function (p, v) { return ( p < v ? p : v ) });
			MM = link_attr_color_data.reduce(function (p, v) { return ( p > v ? p : v ) });
			theLinkColorMapper.SetRange(mm, MM);

			mm = link_attr_size_data.reduce(function (p, v) { return ( p < v ? p : v ) });
			MM = link_attr_size_data.reduce(function (p, v) { return ( p > v ? p : v ) });
			theLinkSizeMapper.SetRange(mm, MM);

			link_color_constant = false;
			link_size_constant = false;

			if (do_feeds)
			{
				for (var i in transit_data['feed_links'])
				{
					linkid = transit_data['feed_links'][i];
					link_feature = transit_link_features[network_linkid_to_index[linkid]];

					pa = []
					for (var i in link_feature.path)
					{
						pt = link_feature.path[i]
						g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
						pa.push(g); 
					}

					ls = new OpenLayers.Geometry.LineString(pa);
					f  = new OpenLayers.Feature.Vector(ls, null, {
						strokeOpacity: 1,
						strokeColor: 'black',
						strokeDashstyle: 'dotted',
						strokeWidth: 1
					});

					p0 = link_feature.path[0];
					p1 = link_feature.path[1];
					p = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
					f.popup_location = new OpenLayers.Geometry.Point(p[0], p[1]).transform(vis_coordinate_system, osm.projection);

					f.featureType = FeatureType.TRANSIT_FEED;
					f.feature_id  = linkid;
							
					features.push(f);
				}
			}

			if (do_links)
				for (var i = 0; i < link_attr_ids.length; i++)
				{
					linkid = link_attr_ids[i];
					color = theLinkColorMapper.Map(link_attr_color_data[i]);
					width = theLinkSizeMapper.Map(link_attr_size_data[i]);
					
					link_feature = transit_link_features[network_linkid_to_index[linkid]];

					pa = []
					for (var j in link_feature.path)
					{
						pt = link_feature.path[j]
						g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
						pa.push(g); 
					}

					ls = new OpenLayers.Geometry.LineString(pa);
					f  = new OpenLayers.Feature.Vector(ls, null, {
						strokeOpacity: 1,
						strokeColor: color,
						strokeWidth: width
					});

					p0 = link_feature.path[0];
					p1 = link_feature.path[1];
					p = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
					f.popup_location = new OpenLayers.Geometry.Point(p[0], p[1]).transform(vis_coordinate_system, osm.projection);

					f.featureType = FeatureType.TRANSIT_LINK;
					f.feature_id  = linkid;
					f.load = value;
						
					features.push(f);
				}

			if (do_stops)
				if (show_nodes_by_attr)
				{
					for (var i = 0; i < node_attr_ids.length; i++)
					{
						nodeid = node_attr_ids[i];
						color = theNodeColorMapper.Map(node_attr_color_data[i]);
						radius = theNodeSizeMapper.Map(node_attr_size_data[i]);
						
						var o  = node_features[network_nodeid_to_index[nodeid]];
						var f = o.clone();
							
						f.style.strokeColor = color;
						f.style.fillColor = color;
						f.style.pointRadius = radius;					
							
						f.popup_location = o.popup_location;
						f.location = o.location;

						f.featureType  = FeatureType.TRANSIT_NODE;
						f.selectable = true;
						f.style.display = 'show'
						f.style.strokeWidth = 2;
						f.style.strokeOpacity = 1.0;
						f.style.fillOpacity = 0.4;
						f.feature_id = nodeid;

						features.push(f);
					}
				}
				else
				{
					var b = transit_data['node_attr_data']['boarding']['tot'];
					var a = transit_data['node_attr_data']['alighting']['tot'];

					for (var i in b)
					{
						nodeid = node_attr_ids[i];
						node = node_features[network_nodeid_to_index[nodeid]];
			
						width_value = a[i] + b[i];
						radius = theNodeSizeMapper.Map(width_value);

						lon = node.location[0];
						lat = node.location[1];

						wedges = pie(lon, lat, radius, [a[i], b[i]]);
						for (w in wedges)
						{
							f = wedges[w];
							f.location	 = node.location;
							f.popup_location = new OpenLayers.Geometry.Point(lon, lat).transform(vis_coordinate_system, osm.projection);
							f.featureType	 = FeatureType.TRANSIT_NODE;
							f.boarding		 = b[i];
							f.alighting		 = a[i];
							f.visible 	 	 = true;
							f.selectable	 = true;
							f.feature_id	 = nodeid;
							f.rindx 	 = 'none';
							f.routes	 = node.routes;

							features.push(f);
						}
					}
				}
		}

	}
	else if ($('#view_type').val() == "transitOD")
	{			
		link_color_constant = true;
		link_size_constant  = true;
		node_color_constant = true;
		node_size_constant  = true;
	
		if (transitOD_mode == 2)
		{
			if (transitOD_data != 0)
			{
				if ($("#transitOD_show_origins").is(':checked') || $("#transitOD_show_destinations").is(':checked'))
				{
					var min, max, divergent = $("#transitOD_show_origins").is(':checked') && $("#transitOD_show_divergent").is(':checked');
					
					if ($("#transitOD_show_origins").is(':checked') && $("#transitOD_show_destinations").is(':checked'))
					{ 	
						if (divergent)
						{
							min = -transitOD_data['origins_minmax'][1];
							max =  transitOD_data['destinations_minmax'][1];
						}
						else
						{
							if (transitOD_data['origins_minmax'][0] < transitOD_data['destinations_minmax'][0])
								min = transitOD_data['origins_minmax'][0];
							else
								min = transitOD_data['destinations_minmax'][0];
							
							if (transitOD_data['origins_minmax'][1] > transitOD_data['destinations_minmax'][1])
								max = transitOD_data['origins_minmax'][1];
							else
								max = transitOD_data['destinations_minmax'][1];
						}
					}
					else if ($("#transitOD_show_origins").is(':checked'))
					{
						min = transitOD_data['origins_minmax'][0];
						max = transitOD_data['origins_minmax'][1];
					}
					else
					{
						min = transitOD_data['destinations_minmax'][0];
						max = transitOD_data['destinations_minmax'][1];
					}
					
					node_color_constant = false;
					node_size_constant  = false;
					
					theNodeColorMapper.SetRange(min, max);
					theNodeSizeMapper.SetRange(min, max);
 
					if ($("#transitOD_show_origins").is(':checked'))
					{
	 					var nodes = transitOD_data['origins']
						for (var nodeid in nodes)
						{
							var value = nodes[nodeid];
							if (divergent) 
								value = -value;
								
							var mapped_node = network_nodeid_to_index[nodeid];
							
							var o = node_features[mapped_node];
							var f = o.clone();
							
							color = theNodeColorMapper.Map(value);					
							f.style.strokeColor = color;
							f.style.fillColor = color;
		
							radius = theNodeSizeMapper.Map(value);
							f.style.pointRadius = radius;					
							
							f.popup_location = o.popup_location;
							f.location = o.location;

							f.featureType  = FeatureType.TRANSIT_OD;
							f.selectable = true;
							f.style.display = 'show'
							f.style.strokeWidth = 2;
							f.style.strokeOpacity = 1.0;
							f.style.fillOpacity = 0.4;
							f.feature_id = nodeid;
							features.push(f);
						}
					}
					
					if ($("#transitOD_show_destinations").is(':checked'))
					{
	 					var nodes = transitOD_data['destinations']
						for (var nodeid in nodes)
						{
							var value = nodes[nodeid];
	
							var mapped_node = network_nodeid_to_index[nodeid];
							
							var o = node_features[mapped_node];
							var f = o.clone();
							
							color = theNodeColorMapper.Map(value);					
							f.style.strokeColor = color;
							f.style.fillColor = color;
		
							radius = theNodeSizeMapper.Map(value);
							f.style.pointRadius = radius;					
							
							f.popup_location = o.popup_location;
							f.location = o.location;

							f.featureType  = FeatureType.TRANSIT_OD;
							f.selectable = true;
							f.style.display = 'show'
							f.style.strokeWidth = 2;
							f.style.strokeOpacity = 1.0;
							f.style.fillOpacity = 0.4;
							f.feature_id = nodeid;
							features.push(f);
						}
					}
				}
				
				if ($("#transitOD_show_links").is(':checked'))
				{
					theLinkColorMapper.SetRange(transitOD_data['links_minmax'][0], transitOD_data['links_minmax'][1]);
					theLinkSizeMapper.SetRange(transitOD_data['links_minmax'][0], transitOD_data['links_minmax'][1]);
					
					link_color_constant = false;
					link_size_constant  = false;
					
					links = transitOD_data['links'];
					for (var linkid in links)
					{
	 					value = links[linkid];
	 					color = theLinkColorMapper.Map(value);
	 					size = theLinkSizeMapper.Map(value);
						
		 				link = transit_link_features[network_linkid_to_index[linkid]];
											
						pa = []
						for (var i in link.path)
						{
						    pt = link.path[i]
							g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
							pa.push(g); 
						}
			    		
						ls     = new OpenLayers.Geometry.LineString(pa);
						f      = new OpenLayers.Feature.Vector(ls, null, {
														strokeColor: color,
														strokeOpacity: 1,
														strokeWidth: size
													});
						
						p0 = link.path[ 0];
						p1 = link.path[link.path.length-1];
						p = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
						f.popup_location = new OpenLayers.Geometry.Point(p[0], p[1]).transform(vis_coordinate_system, osm.projection);
													
						f.featureType   = FeatureType.LINK;
						f.selectable	= true;
						f.feature_id        = linkid;
						f.dir 		    = 'none';
						f.rindx		    = 'none';
						f.style.display = 'show'
						
						features.push(f);
					}	
				}
				
				if ($("#transitOD_show_walks").is(':checked'))
				{
					stops = []
					linkids = []
					mapped_linkids = []

					// Get a list of all the stops along the routes
					for (var linkid in transitOD_data['links'])
					{
						linkids.push(linkid);
						mapped_linkids.push(network_linkid_to_index[linkid]);
		 				link_feature = transit_link_features[linkid];
						if (stops.indexOf(link_feature.source) == -1)
							stops.push(link_feature.source);
						if (stops.indexOf(link_feature.destination) == -1)
							stops.push(link_feature.destination);
					}

					// Get a list of the selected OD nodes

					ODnodes = $('#transitOD_origins').val().split(',').concat($('#transitOD_destinations').val().split(','))

					for (var i in transit_link_features)
					{
						link_feature = transit_link_features[i];
						if (link_feature.type == 100 && (ODnodes.indexOf(link_feature.source) != -1) && (stops.indexOf(link_feature.destination) != -1))
						{
							pa = []
							for (var i in link_feature.path)
							{
								pt = link_feature.path[i]
								g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(vis_coordinate_system, osm.projection);
								pa.push(g); 
							}

							ls = new OpenLayers.Geometry.LineString(pa);
							f  = new OpenLayers.Feature.Vector(ls, null, {
								strokeOpacity: 1,
								strokeColor: 'black',
								strokeDashstyle: 'dotted',
								strokeWidth: 1
							});

							p0 = link_feature.path[0];
							p1 = link_feature.path[1];
							p = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
							f.popup_location = new OpenLayers.Geometry.Point(p[0], p[1]).transform(vis_coordinate_system, osm.projection);

							f.featureType = FeatureType.WALK;
							f.feature_id  = linkid;
					
							features.push(f);
						}
					}
				}
			}	
		}
		else
		{
			/* First, color all centroid nodes red and mark them selectable */
			for (var i in node_features)
			{
				f = node_features[i];
				if (f.type == '100')
				{
					f.style.fillColor = 'red';
					f.style.strokeColor = 'red';
					f.selectable = true;
				}
			}

			/* If any are already selected, color them green and unselectable */
			var already_selected;
			if (transitOD_mode == 0)
				already_selected = $('#transitOD_origins').val()
			else
				already_selected = $('#transitOD_destinations').val()

			if (already_selected != "")
			{
				already_selected = already_selected.split(',')

				for (var i in already_selected)
				{
					var node = already_selected[i];
					var mapped_node = network_nodeid_to_index[node];
					f = node_features[mapped_node];
					f.style.strokeColor = 'green';
					f.style.fillColor = 'green';
					f.selectable = false;
				}
			}
			
			/* Now make them visible */
			for (var i in node_features)
			{
				f = node_features[i]
				if (f.type == '100')
				{
					f1 = f.clone();
					f1.style.display = 'show'
					f1.feature_id = f.feature_id;
					f1.selectable = f.selectable;
					f1.location = f.location;
					f1.popup_location = f.popup_location;
					f1.featureType = f.featureType;
					f1.style.strokeWidth = 2;
					f1.style.pointRadius = 3;
					f1.style.strokeOpacity = 1.0;
					f1.style.fillOpacity = 0.4;
					features.push(f1);
				}
			}
 
		}
	}
	else if ($('#view_type').val() == "debug")
	{			
		nodes = $('#debug_nodes').val().split(',')
		bad_ids = []
		for (var n in nodes)
		{
			node_id = nodes[n].trim();
			if (node_id == "")
				continue;

			var mapped_node = network_nodeid_to_index[node_id];
			if (typeof mapped_node == 'undefined')
			{
				bad_ids.push('n' + node_id);
				continue;
			}

			f = node_features[mapped_node];
			if (typeof f == 'undefined')
			{
				bad_ids.push('n' + node_id);
				continue;
			}

			f1 = f.clone();
			f1.style.fillColor = 'red';
			f1.style.strokeColor = 'red';
			f1.selectable = true;
			f1.style.display = 'show'
			f1.feature_id = f.feature_id;
			f1.selectable = f.selectable;
			f1.location = f.location;
			f1.popup_location = f.popup_location;
			f1.featureType = f.featureType;
			f1.style.strokeWidth = 2;
			f1.style.pointRadius = 3;
			f1.style.strokeOpacity = 1.0;
			f1.style.fillOpacity = 0.4;
			features.push(f1);
		}

		links = $('#debug_links').val().split(',')
		for (var l in links)
		{
			link_id = links[l].trim();
			if (link_id == "")
				continue;

			var mapped_link = network_linkid_to_index[link_id];
			if (typeof mapped_link == 'undefined')
			{
				bad_ids.push('l' + link_id);
				continue;
			}

			f = link_features[mapped_link];
			if (typeof f == 'undefined')
			{
				bad_ids.push('l' + link_id);
				continue;
			}


			f1 = f.clone();
			f1.style.fillColor = 'green';
			f1.style.strokeColor = 'green';
			f1.selectable = true;
			f1.style.display = 'show'
			f1.feature_id = f.feature_id;
			f1.selectable = f.selectable;
			f1.location = f.location;
			f1.popup_location = f.popup_location;
			f1.featureType = f.featureType;
			f1.style.strokeWidth = 2;
			f1.style.pointRadius = 3;
			f1.style.strokeOpacity = 1.0;
			f1.style.fillOpacity = 0.4;
			features.push(f1);
		}

		$('#debug_messages').val(bad_ids.join(' '))
	}


	style_features(features);
    
	dataLayer.addFeatures(features);
	
	post_colormap_annotations();
	
	if (theAnimator != undefined)
		if (number_of_timesteps > 1)
			theAnimator.Show();
		else
			theAnimator.Hide();
}

var underlayer_regular_link_color;
var underlayer_regular_link_width;
var underlayer_regular_link_opacity;
var underlayer_regular_node_color;
var underlayer_regular_node_radius;
var underlayer_regular_node_opacity;
var underlayer_centroid_link_color;
var underlayer_centroid_link_width;
var underlayer_centroid_link_opacity;
var underlayer_centroid_node_color;
var underlayer_centroid_node_radius;
var underlayer_centroid_node_opacity;

function capture_underLayer_preferences()
{
	underlayer_regular_link_color    = $("#underlayer_regular_link_color").val();
	underlayer_regular_link_width    = $("#underlayer_regular_link_width").val();
	underlayer_regular_link_opacity  = $("#underlayer_regular_link_opacity").val();
	underlayer_regular_node_color    = $("#underlayer_regular_node_color").val();
	underlayer_regular_node_radius   = $("#underlayer_regular_node_radius").val();
	underlayer_regular_node_opacity  = $("#underlayer_regular_node_opacity").val();
	underlayer_centroid_link_color    = $("#underlayer_centroid_link_color").val();
	underlayer_centroid_link_width    = $("#underlayer_centroid_link_width").val();
	underlayer_centroid_link_opacity  = $("#underlayer_centroid_link_opacity").val();
	underlayer_centroid_node_color    = $("#underlayer_centroid_node_color").val();
	underlayer_centroid_node_radius   = $("#underlayer_centroid_node_radius").val();
	underlayer_centroid_node_opacity  = $("#underlayer_centroid_node_opacity").val();
}

function capture_underLayer_preferences_and_redraw()
{
	capture_underLayer_preferences();
	underLayer_redraw();
}

function clear_underlayer()
{
	$("#underlayer_show_regular_nodes").prop('checked', false);
	$("#underlayer_show_centroid_nodes").prop('checked', false);
	$("#underlayer_show_regular_links").prop('checked', false);
	$("#underlayer_show_centroid_links").prop('checked', false);
	underLayer_redraw();
}

function underLayer_redraw()
{
	underLayer.removeAllFeatures();
    
	var capacities = link_attributes['capacity']['data'][0];
	var min_capacity = $('#underlayer_capacity_level').val();
	
	var checkedNodeTypes = {};
	if ($("#underlayer_show_regular_nodes").is(':checked')) 
		checkedNodeTypes["1"] = 1;
	if ($("#underlayer_show_centroid_nodes").is(':checked')) 
		checkedNodeTypes["100"] = 1;
 
	var checkedLinkTypes = {}
	if ($("#underlayer_show_regular_links").is(':checked')) 
		checkedLinkTypes["1"] = 1;
	if ($("#underlayer_show_centroid_links").is(':checked')) 
		checkedLinkTypes["100"] = 1;
		 
	features = [];
	
	for (var i in link_features)
	{
		f = link_features[i];
		if (f.type in checkedLinkTypes && capacities[i] >= min_capacity)
		{
			f1 = f.clone();
	    	f1.style.strokeDashstyle = 'solid'
		    f1.style.display = 'show';
	    	f1.feature_id = f.feature_id;
	    	f1.location = f.location;
	    	f1.popup_location = f.popup_location;
	    	f1.featureType = f.featureType;
			if (f.type == '100')
			{
		    	f1.style.strokeColor = 	underlayer_centroid_link_color;
		    	f1.style.strokeWidth = 	underlayer_centroid_link_width;
		    	f1.style.strokeOpacity = underlayer_centroid_link_opacity;				
			}
			else
			{
		    	f1.style.strokeColor = 	underlayer_regular_link_color;
		    	f1.style.strokeWidth = 	underlayer_regular_link_width;
		    	f1.style.strokeOpacity = underlayer_regular_link_opacity;				
			}
			features.push(f1);
		}
	}
			
	for (var i in node_features)
	{
		f = node_features[i]
		if (f.type in checkedNodeTypes)
		{
			f1 = f.clone();
	    	f1.style.display = 'show'
	    	f1.feature_id = f.feature_id;
	    	f1.location = f.location;
	    	f1.popup_location = f.popup_location;
	    	f1.featureType = f.featureType;
			if (f.type == '100')
			{
		    	f1.style.fillColor = underlayer_centroid_node_color;
		    	f1.style.strokeColor = underlayer_centroid_node_color;
		    	f1.style.strokeWidth = 0.6 * underlayer_centroid_node_radius;
		    	f1.style.pointRadius = underlayer_centroid_node_radius;
		       	f1.style.strokeOpacity = underlayer_centroid_node_opacity;
		       	f1.style.fillOpacity = 0.6 * underlayer_centroid_node_opacity;
			}
			else
			{
		    	f1.style.fillColor = underlayer_regular_node_color;
		    	f1.style.strokeColor = underlayer_regular_node_color;
		    	f1.style.strokeWidth = 0.6 * underlayer_regular_node_radius;
		    	f1.style.pointRadius = underlayer_regular_node_radius;
		       	f1.style.strokeOpacity = underlayer_regular_node_opacity;
		       	f1.style.fillOpacity = 0.6 * underlayer_regular_node_opacity;
			}
			features.push(f1);
		}
	}

	underLayer.addFeatures(features);
}

function all_redraw()
{
	underLayer_redraw();
	dataLayer_redraw();
}

function receive_link_data(data)
{
	close_dialog()
	
	if (data['status'] != 'OK')
		error_dialog('Data access error: ' + data['status']);
	else
	{
		for (var varname in data.attribute)
		{
			attribute = data.attribute[varname];
			
			id_map = {}
			for (var i = 0; i < attribute.ids.length; i ++)
				id_map[attribute.ids[i]] = i
				        
		    attribute.id_map = id_map
			attribute_minmax(link_features, attribute)
			link_attributes[varname] = attribute
		}		    
		
		post_link_color_options(varname);	
		post_link_size_options(varname);	
		network_attribute_selection();
	}
}
	
function load_raw_link_data(varname)
{
	network = $("#link_dataset_dialog_network_selector").val()
	name = $("#link_dataset_dialog_dataset_selector").val()
    aggregation = $("#link_dataset_dialog_aggregation_selector").val()
    interval = $("#link_dataset_dialog_interval").val()

    varname = network + ":" + name + "." + aggregation + "(" + interval + ")"
    
	load_link_data(varname, 'raw', varname)
}

function load_raw_node_data(varname)
{
	network = $("#node_dataset_dialog_network_selector").val()
	name = $("#node_dataset_dialog_dataset_selector").val()
    aggregation = $("#node_dataset_dialog_aggregation_selector").val()
    interval = $("#node_dataset_dialog_interval").val()

    varname = network + ":" + name + "." + aggregation + "(" + interval + ")"
    
	load_node_data(varname, 'raw', varname)
}

function receive_node_data(data)
{	
	close_dialog()
	
	if (data['status'] != 'OK')
		error_dialog('Data access error: ' + data['status']);
	else
	{
		for (var varname in data.attribute)
		{
			attribute = data.attribute[varname];
			
			id_map = {}
			for (var i = 0; i < attribute.ids.length; i ++)
				id_map[attribute.ids[i]] = i
				        
		    attribute.id_map = id_map
			attribute_minmax(node_features, attribute)
			node_attributes[varname] = attribute
		}		    
		
		post_node_color_options(varname);	
		post_node_size_options(varname);	
		network_attribute_selection();
	}
}

function load_weighted_average_node_data(network, network2, data, vols, agg, name)
{
	$.ajax({
		url: '/visualizer/load_weighted_average/' + network + '/' + network2 + '/' + data + '/' + vols + '/' + agg + '/' + name,
		dataType : 'json',
		cache: false,
		success: receive_node_data,
		error: load_data_error
		});
}

function load_weighted_average_link_data(network, network2, data, vols, agg, name)
{
	$.ajax({
		url: '/visualizer/load_weighted_average/' + network + '/' + network2 + '/' + data + '/' + vols + '/' + agg + '/' + name,
		dataType : 'json',
		cache: false,
		success: receive_link_data,
		error: load_data_error
		});
}

function load_link_data(varname, units, varstring)
{
	tmp = varstring.replace(RegExp('/', 'g'), 'DIVIDEBY')
	$.ajax({
		url: '/visualizer/load_data/' + network_name + '/' + varname + '/' + units + '/' + tmp,
		dataType : 'json',
		cache: false,
		success: receive_link_data,
		error: load_data_error
		});
}

function load_data_error(x, e)
{
	alert('AJAX/JSON error: ' + e)
}

function load_node_data(varname, units, varstring)
{
	tmp = varstring.replace(RegExp('/', 'g'), 'DIVIDEBY')
	$.ajax({
		url: '/visualizer/load_data/' + network_name + '/' + varname + '/' + units + '/' + tmp,
		dataType : 'json',
		cache: false,
		success: receive_node_data,
		error: load_data_error
		});
}

var OD_which;

function load_OD_nodes(dataset, get_origins, callback)
{
    OD_which = get_origins;

    $.ajax({
		url: '/visualizer/load_OD_nodes/' +  dataset + '/' + get_origins,
		dataType : 'json',
		cache: false,
		success: callback
		});
}

function receive_OD_nodes(data)
{
    if (data['status'] != 'OK')
	error_dialog('Data access error: ' + data['status']);

    if (OD_which == 1)
    {
		node_target_text = 'OD_paths_origins';
		OD_paths_origins = data['nodeids']
    }
    else
    {
		OD_paths_destinations = data['nodeids'];	    
		node_target_text = 'OD_paths_destinations'
    }

    OD_paths_mode = 0   
    dataLayer_redraw()
    enableSelection(OD_paths_node_selection_event, null);
}

function load_OD_reached_nodes()
{
    pathdata = $('#OD_paths_view_options .path_data_select').val()
    
    $('#OD_paths_destinations').val('')

    $.ajax({
            url: '/visualizer/load_OD_reached_nodes/' + network_name + '/1/' + $('#OD_paths_origins').val(),
            dataType : 'json',
            cache: false,
            success: receive_OD_reached_nodes
    });
}

function receive_OD_reached_nodes(data)
{
    if (data['status'] != 'OK')
	error_dialog('Data access error: ' + data['status']);

    if (OD_which == 1)
    {
		node_target_text = 'OD_paths_destinations'
		OD_paths_destinations = data['nodeids']
    }
    else
    {
		node_target_text = 'OD_paths_origins';
		OD_paths_origins = data['nodeids'];
    }

    enableSelection(OD_paths_node_selection_event, null);
    OD_paths_mode = 1   
    dataLayer_redraw()
}

function load_OD_paths(o, d)
{
	var pathdata    = $('#OD_paths_view_data_selector').val()
	var interval    = $('#OD_paths_view_aggregation_interval').val();
	var aggregation = $('[name=ODpath_aggregation_type]:checked').val();
	
	$.ajax({
		url: '/visualizer/load_OD_paths/' + pathdata + '/' + interval + '/' + aggregation + '/' 
			+ document.getElementById('OD_paths_origins').value + '/' + $('#OD_paths_destinations').val(),
		dataType : 'json',
		cache: false,
		success: receive_OD_paths
		});
}

function receive_OD_paths(data)
{
	if (data['status'] != 'OK')
		error_dialog('Data access error: ' + data['status']);

	OD_paths = data;
	
	number_of_timesteps = data.number_of_timesteps;
	set_current_timesteps = 0
 	
	no_dataLayer_redraw = true;
  	post_OD_paths_attribute_options();
	new_OD_paths_color_selection();
	new_OD_paths_size_selection();
    OD_paths_mode = 2

	no_dataLayer_redraw = false;
	post_origin_destination_attribute_options()
	
	if (number_of_timesteps > 1)
	{
		theAnimator.SetTimesteps(data.timesteps);
		theAnimator.SetTimeFrame(0, (number_of_timesteps-1)*data['interval']);
		theAnimator.Do(0);
	}
	else
		dataLayer_redraw();
}


function load_OD_distribution_data()
{
	$('#origin_destination_pull').css('display', 'none');
	$('#origin_destination_display').css('display', 'block');

	var pathdata = $('#origin_destination_view_options .path_data_select').val();
	var interval = $('#origin_destination_view_options .aggregation_interval').val();
	var selector = $('input[name="origin_destination_selector"]:radio:checked').val();

	$.ajax({
		url: '/visualizer/load_OD_distribution_data/' +  pathdata + '/' + interval + '/' + selector  + '/' + $('#origin_destination_selection').val(),
		dataType : 'json',
		cache: false,
		success: receive_OD_distribution_data
		});
}

function receive_OD_distribution_data(data)
{
	if (data['status'] != 'OK')
		error_dialog('Data access error: ' + data['status']);

	OD_distribution_tsteps = data.data
	number_of_timesteps    = data.number_of_timesteps;
	set_current_timesteps  = 0
 	
	if (number_of_timesteps > 1)
	{
		theAnimator.SetTimesteps(data.timesteps);
		theAnimator.SetTimeFrame(0, (number_of_timesteps-1)*data['interval']);
	}

	no_dataLayer_redraw = true;
	
  	post_origin_destination_attribute_options();
  	
  	theNodeColorMapper.SetRange(data.data_range[0], data.data_range[1]);
  	theNodeSizeMapper.SetRange(data.data_range[0], data.data_range[1]);

	origin_destination_mode = 1;

	no_dataLayer_redraw = false;
	
	theAnimator.Do(0);
}

function reset_nodes()
{
	for (var i in node_features)
	{
		feature = node_features[i];
		feature.style.fillOpacity = 0.6;
		feature.style.strokeColor = "#ff0000";
		feature.style.fillColor = "#ff0000";
		feature.style.strokeOpacity = 1;
		feature.style.strokeWidth = 3;
		feature.style.pointRadius = '4';
	}
}

function RT_origins_selected(ev)
{    
    if (ev.feature.selectable)
    {
    	ev.feature.selectable = false;
		txt = $('#RT_origin_nodes')
		if (txt.val() == "")
			txt.val(ev.feature.feature_id)
		else
			txt.val(txt.val() + ',' + ev.feature.feature_id)
 	}
}

function receive_RT_nodes(data)
{
   if (data['status'] != 'OK')
		error_dialog('Data access error: ' + data['status']);
   
    RT_origin_nodes = data['nodeids']
    RT_view_mode = 0   
  
    enableSelection(RT_origins_selected, function(e) { dataLayer_redraw(); })
    dataLayer_redraw()
    
}

function start_reachtime()
{
	str = ''
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
	    	str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}

	$('#RT_dataset_selector').html(str)
	$('#RT_origin_nodes').val('');
	
	$('#reachtime_view_options').show();

    number_of_timesteps = 1;
    RT_data = []
    
    load_OD_nodes($('#RT_dataset_selector').val(), 1, receive_RT_nodes); 
}

function reset_reachtime()
{
	$('#RT_origin_nodes').val('');
	RT_view_mode = 0;
	enableSelection(RT_origins_selected, function(e) { dataLayer_redraw(); });
	dataLayer_redraw();
	
	$('#reachtime_view_display').css('display', 'none');
	$('#reachtime_view_selection').css('display', 'block');
}

function receive_RT_data(data)
{
	if (data['status'] != 'OK')
	{
		error_dialog('Data access error: ' + data['status']);
		return;
	}
   
	RT_data = data;
	RT_view_mode = 1;
	
	number_of_timesteps = RT_data['timesteps'].length;
	set_current_timesteps = 0
 	
	if (number_of_timesteps > 1)
	{
		theAnimator.SetTimesteps(data.timesteps);
		theAnimator.SetTimeFrame(0, (number_of_timesteps-1)*data['interval']);
	}

	no_dataLayer_redraw = true;
	
	theContourColorMapper.SetQuantization(data['contour_levels'].length)
	theContourColorMapper.SetRange(0, data['contour_levels'].length)
	
	theContourSizeMapper.SetRange(0, data['max'])

	no_dataLayer_redraw = false;
	post_origin_destination_attribute_options()
	theAnimator.Do(0);
}
	
function do_reachtime()
{
	dataset = $('#RT_dataset_selector').val()
	origins = $('#RT_origin_nodes').val()
	interval = $('#RT_interval').val()
	contours = $('#RT_contour_levels').val()
	wndw = $('#RT_wndw').val()
	width = $('#RT_width').val()
	clip = $('#RT_departure_clip').is(':checked')
	elim_passed = $('#RT_eliminate_passed').is(':checked')
	artery = $('#RT_artery').val()
	
	$.ajax({
		url: '/visualizer/load_reachtime/' + dataset + '/' + origins + '/' + interval + '/' + contours + '/' + wndw + '/' + width + '/' + clip + '/' + elim_passed + '/' + artery,
		dataType : 'json',
		cache: false,
		success: receive_RT_data,
		});
	
	disableSelection();
	
	$("#reachtime_dataset").html('Dataset: ' + dataset)
	$("#reachtime_contours").html('Contours: ' + contours)
	$('#reachtime_view_selection').css('display', 'none');
	$('#reachtime_view_display').css('display', 'block');
}

var current_view_type;


function new_view_type(value)
{
	$(".options_panel").each(function() {$(this).hide()});
	number_of_timesteps = 0;
	theAnimator.Hide();
	disableSelection();
	popdown();
	
	if (current_view_type == 'network')
	{
	}
	else 
	{
		if (value == 'network_data')
		{
		}
		else if (value == 'linkpaths')
		{
			$('#linkpath_view_options_selection').css('display', 'none');
			$('#linkpath_view_options_display').css('display', 'none');
		}
		else if (value == 'busroute')
		{
		}
		else if (value == 'OD_paths')
		{	
			$('#OD_paths_view_display').css('display', 'none');
			$('#OD_paths_view_selection').css('display', 'none');

		}
		else if (value == 'origin_destination')
		{		
			$('#origin_destination_pull').css('display', 'none');
			$('#origin_destination_load').css('display', 'none');
			$('#origin_destination_display').css('display', 'none');
		}
		else if (value == 'reachtime')
		{
			$('#reachtime_view_selection').css('display', 'none');
			$('#reachtime_view_display').css('display', 'none');
		}
		else if (value == 'transit')
		{
			$('#transit_view_options').css('display', 'none');
			dataLayer_redraw();
		}
		else if (value == 'transitOD')
		{
			$('#transitOD_view_options').css('display', 'none');
			dataLayer_redraw();
		}
		else if (value == 'debug')
		{
			$('#debug_view_options').css('display', 'none');
			dataLayer_redraw();
		}
	}
	
	if (value == 'network')
	{
		underLayer.setZIndex(1001);
		dataLayer.setZIndex(0);

		dataLayer_redraw()
	}
	else 
	{
		underLayer.setZIndex(0);
		dataLayer.setZIndex(1001);
		
		if (value == 'network_data')
		{
			network_attribute_selection();
			dataLayer_redraw()
		}
		else if (value == 'linkpaths')
		{
			$('#linkpath_view_options_selection').css('display', 'block');
			select_links_for_linkpaths();
		}
		else if (value == 'busroute')
		{
			busroute_selection();
		}
		else if (value == 'OD_paths')
		{	
			$('#OD_paths_view_display').css('display', 'none');
			$('#OD_paths_view_selection').css('display', 'block');

			new_OD_paths_selection()
		}
		else if (value == 'origin_destination')
		{		
			$('#origin_destination_load').css('display', 'block');
			new_origin_destination_selection()
		}
		else if (value == 'reachtime')
		{
			$('#reachtime_view_selection').css('display', 'block');
			start_reachtime()
		}
		else if (value == 'transit')
		{
			clear_underlayer();
			$('#transit_view_options').css('display', 'block');
		}
		else if (value == 'transitOD')
		{
			clear_underlayer();
			$('#transitOD_origins').val("");
			$('#transitOD_destinations').val("");
			// $('#transitOD_doit').attr("disabled", "disabled");
			$('#transitOD_view_options').css('display', 'block');
		}
		else if (value == 'debug')
		{
			$('#debug_view_options').css('display', 'block');
		}
	}
	
	current_view_type = value;
  resize_app();
}

function new_origin_destination_attribute_selection()
{
    dataLayer_redraw();
}

function new_origin_destination_selection()
{
	$('#origin_destination_view_options').show();

	$('#origin_destination_selection').val('')
	
    $('#origin_destination_view_options .path_data_select').removeAttr('disabled');
    $('#origin_destination_view_options .aggregation_interval').removeAttr('disabled');
    $('input[name="OD_select"]:radio:checked').removeAttr('disabled');
    
    $('#origin_destination_origin_selection_done_button').attr("disabled", "disabled");
    $('#origin_destination_origin_selection_clear_button').attr("disabled", "disabled");
 
    number_of_timesteps = 0;
    origin_destination_mode = 0;		
    origin_destination_nodes = [];
    dataLayer_redraw();
    
	$('#origin_destination_pull').css('display', 'none');
	$('#origin_destination_load').css('display', 'block');
	$('#origin_destination_display').css('display', 'none');

}

function load_origin_destination_nodes()
{	
    var selector = $('input[name="origin_destination_selector"]:radio:checked').val();
    var dataset = $('#view_options_load_data_selector').val();
    load_OD_nodes(dataset, selector, receive_origin_destination_nodes)
	$(".origin_destination_dataset").each(function() {$(this).html('Paths Dataset: ' + dataset)});
	$('#origin_destination_load').css('display', 'none');
	$('#origin_destination_pull').css('display', 'block');
}

function receive_origin_destination_nodes(data)
{
    if (data['status'] != 'OK')
    	error_dialog('Data access error: ' + data['status']);
    else
    {
    	origin_destination_nodes = data['nodeids'];
    	dataLayer_redraw();
    }

    select_origin_destination_nodes();
}

function Interpolate(start, end, steps, count) 
{
	var s = start;
	var e = end;
	var final = s + (((e - s) / steps) * count);
	return Math.floor(final);
}

function val_to_color(v, min, max)
{
	val = 100.0 * (v - min)/(max - min);
	
	if (val > 50)
	{
		start = [0,255,0];
		end   = [255,0,0];
		val   = val - 50.0;
	}
	else
	{
		start = [0,0,255];
		end   = [0,255,0];
	}
	
	var r = Interpolate(start[0], end[0], 50, val);
	var g = Interpolate(start[1], end[1], 50, val);
	var b = Interpolate(start[2], end[2], 50, val);
	
	if (r < 16) rs = '0' + r.toString(16);
	else rs = r.toString(16);
	
	if (g < 16) gs = '0' + g.toString(16);
	else gs = g.toString(16);
	
	if (b < 16) bs = '0' + b.toString(16);
	else bs = b.toString(16);
	
	return "#" + rs + gs + bs;
}

function change_map_intensity(v)
{
	temp_map_intensity = map_intensity + v
	if (temp_map_intensity >= 1.0) 
	{
		document.getElementById('mapIntensityUp').disabled = true
		document.getElementById('mapIntensityDown').disabled = false
		map_intensity = 1.0
	}
	else if (temp_map_intensity <= 0.0) 
	{
		document.getElementById('mapIntensityUp').disabled = false
		document.getElementById('mapIntensityDown').disabled = true
		map_intensity = 0.0
	}
	else
	{	
		document.getElementById('mapIntensityUp').disabled = false
		document.getElementById('mapIntensityDown').disabled = false
		map_intensity = temp_map_intensity
	}
	set_map_intensity(map_intensity)
}

function set_map_intensity(v)
{
	map_intensity = v;
	osm.setOpacity(map_intensity)
}

function error_dialog(message)
{   
	dlg = $( "#dialog" )
    dlg.dialog('option', 'title', 'Error!')
    dlg.html(message)
    dlg.dialog("open");
}

function warning_dialog(message)
{   
	dlg = $( "#dialog" )
    dlg.dialog('option', 'title', 'Warning!')
    dlg.html(message)
    dlg.dialog("open");
}

function close_dialog()
{
	dlg = $( "#dialog" )
    dlg.dialog("close")
}

function open_corridor_travel_time_dialog(title, button_string, callback)
{	
    str = '<label>Network:</label><input type="text" id="ctt_network_text">' +
      '<input type="button" value="' + button_string + '" ' +
      ' onclick="' + callback + '($(&quot;#ctt_network_text&quot;).val())"' +
      '>'
      
     open_dialog(title, str, 350, function() {});
}

function receive_link_dataset_list(data)
{
	selector = $( '#link_dataset_dialog_dataset_selector');
	str = '<option value="none">select one</option>';
	for (var i in data.datasets)
	{
		dataset = data.datasets[i];
		str += '<option value="' + dataset + '">' + dataset + '</option>';
	}
	selector.html(str);
}

function link_dataset_dialog_set_network(value)
{
	$.ajax({
		url: '/visualizer/list_datasets/' + value,
		dataType : 'json',
		cache: false,
		success: receive_link_dataset_list
		});
}

function enable_open_link_dataset_dialog_doit()
{
	$("#link_dataset_dialog_ok_button").prop("disabled", false);
}

function manage_link_dataset_interval_input()
{
	if ($("#link_dataset_dialog_aggregation_selector").val() == "none")
	    $("#link_dataset_dialog_interval").attr("disabled", "disabled");
	else
	    $("#link_dataset_dialog_interval").removeAttr("disabled");
}

function open_link_dataset_dialog()
{	 
    str  = '<div id=load_link_data_dialog_tabs style="width: 95%; height: 95%">'
	str += '<ul>'
	    str += '<li><a href="#load_link_data_dialog_raw">Raw</a></li>'
	    str += '<li><a href="#load_link_data_dialog_predefined">Predefined</a></li>'
	    str += '<li><a href="#load_link_data_dialog_custom">Custom</a></li>'
	str += '</ul>'

  	str += '<div id=load_link_data_dialog_raw>'
	    str += '<table style="width: auto">'
		str += '<tr>'
		    str += '<td>'
			str += 'Network:'
		    str += '</td><td>'
			str += '<select id="link_dataset_dialog_network_selector" style="width: 100%" onchange="link_dataset_dialog_set_network(value)">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
			str += '</select>'
		    str += '</td>'
		str += '</tr><tr>'
		    str += '<td>'
			str += 'Dataset:'
		    str += '</td><td>'
			str += '<select id="link_dataset_dialog_dataset_selector" style="width: 100%" onchange=enable_open_link_dataset_dialog_doit()>wait...</select>'
		    str += '</td>'
		str += '</tr><tr>'
		    str += '<td>'
			str += 'Aggregation:'
		    str += '</td><td>'
			str += '<select style="float: left; position: relative;" id="link_dataset_dialog_aggregation_selector" onchange=manage_link_dataset_interval_input()>'
			    str += '<option value="none" selected">none</option>'
			    str += '<option value="sum">sum</option>'
			    str += '<option value="avg">avg</option>'
			    str += '<option value="min">min</option>'
			    str += '<option value="max">max</option>'
			    str += '<option value="delta">delta</option>'
			str += '</select>'
			str += '<input type=text id=link_dataset_dialog_interval style="left: 10px; width:35px; float: left; position: relative" value=15 disabled>'
		    str += '</td>'
		str += '</tr><tr>'
		    str += '<td>'
			str += '<input type="button" disabled id="link_dataset_dialog_ok_button" value="Load" onclick=load_raw_link_data();$("#dialog").dialog("close")>'
		    str += '</td><td>'
		    str += '</td>'
		str += '</tr>'
	    str += '</table>'
    str += '</div>'
	
 	str += '<div id=load_link_data_dialog_predefined>'
		str += '<div id=load_link_data_predefined_options style="width: 49%; height: 150px; position: relative; float: left">'
        	str += '<label>Name:</label>'
        	str += '<input type=text id=load_link_predefined_name>'
        	str += '<div style="height: 10px"></div>'
         		str += "<input type=radio name=load_link_data_predefined_option id=load_link_data_predefined_Volume onclick='"
        			str += '$(".load_link_data_predefined_panel").each(function(){$(this).hide()});load_volume_panel()'
        			str += "'><label for=load_link_data_predefined_Volume>Volume</label>"
        		str += '<br>'
       			str += "<input type=radio name=load_link_data_predefined_option id=load_link_data_predefined_V_Over_C onclick='"
	       			str += '$(".load_link_data_predefined_panel").each(function(){$(this).hide()});load_v_over_c_panel()'
	        		str += "'><label for=load_link_data_predefined_V_Over_C>V_Over_C</label>"
        		str += '<br>'
       			str += "<input type=radio name=load_link_data_predefined_option id=load_link_data_predefined_experienced_speed onclick='"
	       			str += '$(".load_link_data_predefined_panel").each(function(){$(this).hide()});load_experienced_speed_panel()'
	        		str += "'><label for=load_link_data_predefined_experienced_speed>Exp. Speed</label>"
        		str += '<br>'
       			str += "<input type=radio name=load_link_data_predefined_option id=load_link_data_predefined_experienced_speed_ratio onclick='"
	       			str += '$(".load_link_data_predefined_panel").each(function(){$(this).hide()});load_experienced_speed_ratio_panel()'
	        		str += "'><label for=load_link_data_predefined_experienced_speed>Exp. Speed Ratio</label>"
        		str += '<br>'
       			str += "<input type=radio name=load_link_data_predefined_option id=load_link_data_predefined_LinkDelay onclick='"
	       			str += '$(".load_link_data_predefined_panel").each(function(){$(this).hide()});load_link_delay_panel()'
	        		str += "'><label for=load_link_data_predefined_link_delay>Link Delay</label>"
        		str += '<br>'
		str += '</div>'
		str += '<div id=load_link_data_predefined_panels style="width: 49%; height: 150px; position: relative; float: left"></div>'
	str += '</div>'
	
 	str += '<div id=load_link_data_dialog_custom style="width: auto; height: auto">'
 		str += '<div id=load_link_data_dialog_custom_top>'
 			str += '<table><tr>'
 			    str += '<td>Name:</td><td><input type=text id=load_link_custom_name></td>'
	 			str += '</tr><tr>'
 			    str += '<td>Units:</td><td><input type=text id=load_link_custom_units></td>'
		    str += '</tr></table>'
 			str += '<div style="height: 10px"></div>'
			str += '<label>Expression:</label><br>'
		str += '</div>'
		str += '<textarea id="load_link_data_custom_expression" style="width: 100%"></textarea>'
 		str += '<div id=load_link_data_dialog_custom_bottom>'
 			str += '<div style="height: 20px"></div>'
		    str += '<input type=button value=Load onclick=load_custom_link_data()>'
 		str += '</div>'
	str += '</div>'

    open_dialog('Link Dataset', str, 400, function() { 
      									var dlght = parseFloat($('#load_link_data_dialog_tabs').css('height')) - 55
    									var tht = parseFloat($('#load_link_data_dialog_custom_top').css('height'))
    									var bht = parseFloat($('#load_link_data_dialog_custom_bottom').css('height'))
     									$('#load_link_data_custom_expression').css('height', Math.floor(dlght - (tht+bht)))
   								  });
        		
        		
    link_dataset_dialog_set_network(network_name);
    
    $(load_link_data_dialog_tabs).ready(function () {$(load_link_data_dialog_tabs).tabs();});
    
    $( "#tabs" ).tabs();
}

function load_volume_panel()
{
	$('#load_link_data_predefined_panels').html("")

   	str  = '<div class=load_link_data_predefined_panel style="width: auto; height: 100%;">'
	str += 'Network:'
	str += '<select id="load_link_data_predefined_panel_Volume_network_selector" style="width: 96%">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += 'Aggregation:'
	str += '<input type=text id="load_link_data_predefined_panel_Volume_interval" style="width: 96%" value=15><br>'
	str += '<input type=checkbox id="load_link_data_predefined_panel_Volume_compare_checkbox">Compare with:<br>'
	str += '<select id="load_link_data_predefined_panel_Volume_network2_selector" style="width: 96%">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += '<input type=button value=Load onclick=load_volume_panel_action()>'
	str += '</div>'

	$('#load_link_data_predefined_panels').html(str)
}

function load_volume_panel_action()
{
	varname = $("#load_link_predefined_name").val(); 
	if (varname == "")
		alert('A variable name is required')
	else
	{
		network = $("#load_link_data_predefined_panel_Volume_network_selector").val();
		aggregation = $("#load_link_data_predefined_panel_Volume_interval").val();
		varstring = network + ":Flowin.delta(" + aggregation + ")";
		
		if ($("#load_link_data_predefined_panel_Volume_compare_checkbox").is(":checked"))
		{
			network2 = $("#load_link_data_predefined_panel_Volume_network2_selector").val()
			varstring += '- ' + network2 + ":Flowin.delta(" + aggregation + ")";
		}
		load_link_data(varname, 'vehicles', varstring);
	}
}

function load_experienced_speed_panel()
{
	$('#load_link_data_predefined_panels').html("")
   	str  = '<div class=load_link_data_predefined_panel style="width: auto; height: 100%;">'
	str += 'Network:'
	str += '<select id="load_link_data_predefined_panel_experienced_speed_network_selector" style="width: 96%">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += 'Aggregation:'
	str += '<input type=text id="load_link_data_predefined_panel_experienced_speed_interval" style="width: 96%" value=15><br>'
	str += '<input type=checkbox id="load_link_data_predefined_panel_experienced_speed_compare_checkbox">Compare with:<br>'
	str += '<select id="load_link_data_predefined_panel_experienced_speed_network2_selector" style="width: 96%">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += '<input type=button value=Load onclick=load_experienced_speed_panel_action()>'
	str += '</div>'

	$('#load_link_data_predefined_panels').html(str)
}

function load_experienced_speed_panel_action()
{
	varname = $("#load_link_predefined_name").val(); 
	if (varname == "")
		alert('A variable name is required')
	else
	{
		network = $("#load_link_data_predefined_panel_experienced_speed_network_selector").val();
		aggregation = $("#load_link_data_predefined_panel_experienced_speed_interval").val();
		pgm  = 'ml = ' + network + ':model_length;'
		pgm += 'wtt = ' + network + ':WeightedTotalTravelTime.sum(' + aggregation + ');'
		pgm += 'tv = ' + network + ':TravelVolume.sum(' + aggregation + ');'
		pgm += 'r = 3600 * (ml / (wtt / tv));'
		
		if ($("#load_link_data_predefined_panel_experienced_speed_compare_checkbox").is(":checked"))
		{
			network2 = $("#load_link_data_predefined_panel_experienced_speed_network2_selector").val()
			pgm += 'ml = ' + network + ':model_length;'
			pgm += 'wtt = ' + network + ':WeightedTotalTravelTime.sum(' + aggregation + ');'
			pgm += 'tv = ' + network + ':TravelVolume.sum(' + aggregation + ');'
			pgm += 'spd = ' + network + ':speed;'
			pgm += 'r1 = 3600 * (ml / (wtt / tv)) / spd;'
			pgm += 'r = r - r1;'
		}
		
		load_link_data(varname, 'vehicles', pgm);
	}
}

function load_experienced_speed_ratio_panel()
{
	$('#load_link_data_predefined_panels').html("")
   	str  = '<div class=load_link_data_predefined_panel style="width: auto; height: 100%;">'
	str += 'Network:'
	str += '<select id="load_link_data_predefined_panel_experienced_speed_ratio_network_selector" style="width: 96%">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += 'Aggregation:'
	str += '<input type=text id="load_link_data_predefined_panel_experienced_speed_ratio_interval" style="width: 96%" value=15><br>'
	str += '<input type=checkbox id="load_link_data_predefined_panel_experienced_speed_ratio_compare_checkbox">Compare with:<br>'
	str += '<select id="load_link_data_predefined_panel_experienced_speed_ratio_network2_selector" style="width: 96%">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += '<input type=button value=Load onclick=load_experienced_speed_ratio_panel_action()>'
	str += '</div>'

	$('#load_link_data_predefined_panels').html(str)
}

function load_experienced_speed_ratio_panel_action()
{
	varname = $("#load_link_predefined_name").val(); 
	if (varname == "")
		alert('A variable name is required')
	else
	{
		network = $("#load_link_data_predefined_panel_experienced_speed_ratio_network_selector").val();
		aggregation = $("#load_link_data_predefined_panel_experienced_speed_ratio_interval").val();
		
		pgm  = 'ml = ' + network + ':model_length;'
		pgm += 'wtt = ' + network + ':WeightedTotalTravelTime.sum(' + aggregation + ');'
		pgm += 'tv = ' + network + ':TravelVolume.sum(' + aggregation + ');'
		pgm += 'spd = ' + network + ':speed;'
		pgm += 'r = (3600 * (ml / (wtt / tv))) / spd;'
		
		if ($("#load_link_data_predefined_panel_experienced_speed_ratio_compare_checkbox").is(":checked"))
		{
			network2 = $("#load_link_data_predefined_panel_experienced_speed_ratio_network2_selector").val();
			pgm += 'ml = ' + network2 + ':model_length;'
			pgm += 'wtt = ' + network2 + ':WeightedTotalTravelTime.sum(' + aggregation + ');'
			pgm += 'tv = ' + network2 + ':TravelVolume.sum(' + aggregation + ');'
			pgm += 'spd = ' + network2 + ':speed;'	
			pgm += 'r1 = (3600 * (ml / (wtt / tv))) / spd;'
			pgm += 'r = r - r1;'
		}
		
		load_link_data(varname, 'vehicles', pgm);
	}
}

function load_v_over_c_panel()
{
	$('#load_link_data_predefined_panels').html("")
	str  = '<div class=load_link_data_predefined_panel id=load_link_data_predefined_panel_V_Over_C style="width: auto; height: 100%; ">'
	str += 'Network:'
	str += '<select id="load_link_data_predefined_panel_V_Over_C_network_selector" style="width: 100%">';
	for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += 'Aggregation:'
	str += '<input type=text id="load_link_data_predefined_panel_V_Over_C_interval" style="width: 96%" value=15><br>'
	str += '<input type=checkbox id="load_link_data_predefined_panel_V_Over_C_compare_checkbox">Compare with:<br>'
	str += '<select id="load_link_data_predefined_panel_V_Over_C_network2_selector" style="width: 100%">';
	for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	
	str += '<input type=button value=Load onclick=load_v_over_c_action()>'
	str += '</div>'

	$('#load_link_data_predefined_panels').html(str)
}

function load_v_over_c_action()
{
	varname = $("#load_link_predefined_name").val()
	if (varname == "")
		alert('A variable name is required')
	else
	{
		varname = $("#load_link_predefined_name").val()
		network = $("#load_link_data_predefined_panel_V_Over_C_network_selector").val()
		aggregation = $("#load_link_data_predefined_panel_V_Over_C_interval").val()
		
		varstring = '(' + network + ":Flowin.delta(" + aggregation + ") / (" + network + ":capacity *" + network + ":capacity))"
				
	if ($("#load_link_data_predefined_panel_V_Over_C_compare_checkbox").is(":checked"))
		{
			network2 = $("#load_link_data_predefined_panel_V_Over_C_network2_selector").val()
			varstring = '-(' + network2 + ":Flowin.delta(" + aggregation + ") / (" + network2 + ":capacity *" + network2 + ":capacity))"
		}
		
		load_link_data(varname, 'vehicles over capacity difference', varstring)
	}
}

function load_link_delay_panel()
{
	$('#load_link_data_predefined_panels').html("")
	str  = '<div class=load_link_data_predefined_panel id=load_link_data_predefined_panel_LinkDelay style="width: auto; height: 100%; ">'
	str += 'Network:'
	str += '<select id="load_link_data_predefined_panel_LinkDelay_network_selector" style="width: 100%">';
	for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += 'Aggregation:'
	str += '<input type=text id="load_link_data_predefined_panel_LinkDelay_interval" style="width: 96%" value=15><br>'
	str += '<input type=checkbox id="load_link_data_predefined_panel_LinkDelay_compare_checkbox">Compare with:<br>'
	str += '<select id="load_link_data_predefined_panel_LinkDelay_network2_selector" style="width: 100%">';
	for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	
	str += '<input type=button value=Load onclick=load_link_delay_action()>'
	str += '</div>'

	$('#load_link_data_predefined_panels').html(str)
}

function load_link_delay_action()
{
	varname = $("#load_link_predefined_name").val()
	if (varname == "")
		alert('A variable name is required')
	else
	{
		varname = $("#load_link_predefined_name").val()
		network = $("#load_link_data_predefined_panel_LinkDelay_network_selector").val()
		aggregation = $("#load_link_data_predefined_panel_LinkDelay_interval").val()
		
		if ($("#load_link_data_predefined_panel_LinkDelay_compare_checkbox").is(":checked"))
			network2 = $("#load_link_data_predefined_panel_LinkDelay_network2_selector").val()
		else
			network2 = "none"

		load_weighted_average_link_data(network, network2, 'WeightedLinkMotionDelay', 'LinkMotionVolume', aggregation, varname)

	}
}


function load_node_delay_panel()
{
	$('#load_node_data_predefined_panels').html("")
	str  = '<div class=load_node_data_predefined_panel id=load_node_data_predefined_panel_NodeDelay style="width: auto; height: 100%; ">'
	str += 'Network:'
	str += '<select id="load_node_data_predefined_panel_NodeDelay_network_selector" style="width: 100%">';
	for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	str += 'Aggregation:'
	str += '<input type=text id="load_node_data_predefined_panel_NodeDelay_interval" style="width: 96%" value=15><br>'
	str += '<input type=checkbox id="load_node_data_predefined_panel_NodeDelay_compare_checkbox">Compare with:<br>'
	str += '<select id="load_node_data_predefined_panel_NodeDelay_network2_selector" style="width: 100%">';
	for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
	str += '</select>'
	
	str += '<input type=button value=Load onclick=load_node_delay_action()>'
	str += '</div>'

	$('#load_node_data_predefined_panels').html(str)
}

function load_node_delay_action()
{
	varname = $("#load_node_predefined_name").val()
	if (varname == "")
		alert('A variable name is required')
	else
	{
		varname = $("#load_node_predefined_name").val()
		network = $("#load_node_data_predefined_panel_NodeDelay_network_selector").val()
		aggregation = $("#load_node_data_predefined_panel_NodeDelay_interval").val()
		
		if ($("#load_link_data_predefined_panel_NodeDelay_compare_checkbox").is(":checked"))
			network2 = $("#load_link_data_predefined_panel_NodeDelay_network2_selector").val()
		else
			network2 = "none"

		load_weighted_average_node_data(network, network2, 'WeightedNodeMotionDelay', 'NodeMotionVolume', aggregation, varname)
	}
}

function load_custom_link_data()
{
	varname = $("#load_link_custom_name").val()
	units = $("#load_link_custom_units").val()
	expression = $("#load_link_data_custom_expression").val()
	if ((varname.length > 0) && (expression.length > 0))
	{
		link_attributes[varname] = units;
		load_link_data(varname, units, expression)
	}
	else
		alert('Both a variable name and an expression are required')
}

//############

function receive_node_dataset_list(data)
{
	selector = $( '#node_dataset_dialog_dataset_selector');
	str = '<option value="none">select one</option>';
	for (var i in data.datasets)
	{
		dataset = data.datasets[i];
		str += '<option value="' + dataset + '">' + dataset + '</option>';
	}
	selector.html(str);
}

function node_dataset_dialog_set_network(value)
{
	$.ajax({
		url: '/visualizer/list_datasets/' + value,
		dataType : 'json',
		cache: false,
		success: receive_node_dataset_list
		});
}

function enable_open_node_dataset_dialog_doit()
{
	$("#node_dataset_dialog_ok_button").prop("disabled", false);
}

function manage_node_dataset_interval_input()
{
	if ($("#node_dataset_dialog_aggregation_selector").val() == "none")
	    $("#node_dataset_dialog_interval").attr("disabled", "disabled");
	else
	    $("#node_dataset_dialog_interval").removeAttr("disabled");
}

function open_node_dataset_dialog()
{	 
    str  = '<div id=load_node_data_dialog_tabs style="width: 95%; height: 95%">'
	str += '<ul>'
	    str += '<li><a href="#load_node_data_dialog_raw">Raw</a></li>'
	    str += '<li><a href="#load_node_data_dialog_predefined">Predefined</a></li>'
	    str += '<li><a href="#load_node_data_dialog_custom">Custom</a></li>'
	str += '</ul>'

  	str += '<div id=load_node_data_dialog_raw>'
	    str += '<table style="width: auto">'
		str += '<tr>'
		    str += '<td>'
			str += 'Network:'
		    str += '</td><td>'
			str += '<select id="node_dataset_dialog_network_selector" style="width: 100%" onchange="node_dataset_dialog_set_network(value)">';
    for (var a in network_list)
	{
	    d = network_list[a]
	    if (d == network_name)
			str += '<option value="' + d + '" selected>' + d + '</option>';
		else
			str += '<option value="' + d + '">' + d + '</option>';
	}
			str += '</select>'
		    str += '</td>'
		str += '</tr><tr>'
		    str += '<td>'
			str += 'Dataset:'
		    str += '</td><td>'
			str += '<select id="node_dataset_dialog_dataset_selector" style="width: 100%" onchange=enable_open_node_dataset_dialog_doit()>wait...</select>'
		    str += '</td>'
		str += '</tr><tr>'
		    str += '<td>'
			str += 'Aggregation:'
		    str += '</td><td>'
			str += '<select style="float: left; position: relative;" id="node_dataset_dialog_aggregation_selector" onchange=manage_node_dataset_interval_input()>'
			    str += '<option value="none" selected">none</option>'
			    str += '<option value="sum">sum</option>'
			    str += '<option value="avg">avg</option>'
			    str += '<option value="min">min</option>'
			    str += '<option value="max">max</option>'
			    str += '<option value="delta">delta</option>'
			str += '</select>'
			str += '<input type=text id=node_dataset_dialog_interval style="left: 10px; width:35px; float: left; position: relative" value=15 disabled>'
		    str += '</td>'
		str += '</tr><tr>'
		    str += '<td>'
			str += '<input type="button" disabled id="node_dataset_dialog_ok_button" value="Load" onclick=load_raw_node_data();$("#dialog").dialog("close")>'
		    str += '</td><td>'
		    str += '</td>'
		str += '</tr>'
	    str += '</table>'
    str += '</div>'
	
 	str += '<div id=load_node_data_dialog_predefined>'
		str += '<div id=load_node_data_predefined_options style="width: 49%; height: 150px; position: relative; float: left">'
        	str += '<label>Name:</label>'
        	str += '<input type=text id=load_node_predefined_name>'
        	str += '<div style="height: 10px"></div>'
       			str += "<input type=radio name=load_node_data_predefined_option id=load_node_data_predefined_NodeDelay onclick='"
	       			str += '$(".load_node_data_predefined_panel").each(function(){$(this).hide()});load_node_delay_panel()'
	        		str += "'><label for=load_node_data_predefined_node_delay>Signal Delay</label>"
        		str += '<br>'
		str += '</div>'
		str += '<div id=load_node_data_predefined_panels style="width: 49%; height: 150px; position: relative; float: left"></div>'
	str += '</div>'
	
 	str += '<div id=load_node_data_dialog_custom style="width: auto; height: auto">'
 		str += '<div id=load_node_data_dialog_custom_top>'
 			str += '<table><tr>'
 			    str += '<td>Name:</td><td><input type=text id=load_node_custom_name></td>'
	 			str += '</tr><tr>'
 			    str += '<td>Units:</td><td><input type=text id=load_node_custom_units></td>'
		    str += '</tr></table>'
 			str += '<div style="height: 10px"></div>'
			str += '<label>Expression:</label><br>'
		str += '</div>'
		str += '<textarea id="load_node_data_custom_expression" style="width: 100%"></textarea>'
 		str += '<div id=load_node_data_dialog_custom_bottom>'
 			str += '<div style="height: 20px"></div>'
		    str += '<input type=button value=Load onclick=load_custom_node_data()>'
 		str += '</div>'
	str += '</div>'

    open_dialog('Node Dataset', str, 400, function() { 
      									var dlght = parseFloat($('#load_node_data_dialog_tabs').css('height')) - 55
    									var tht = parseFloat($('#load_node_data_dialog_custom_top').css('height'))
    									var bht = parseFloat($('#load_node_data_dialog_custom_bottom').css('height'))
     									$('#load_node_data_custom_expression').css('height', Math.floor(dlght - (tht+bht)))
   								  });
        		
        		
    node_dataset_dialog_set_network(network_name);
    
    $(load_node_data_dialog_tabs).ready(function () {$(load_node_data_dialog_tabs).tabs();});
    
    $( "#tabs" ).tabs();
}


function load_custom_node_data()
{
	varname = $("#load_node_custom_name").val()
	units = $("#load_node_custom_units").val()
	expression = $("#load_node_data_custom_expression").val()
	if ((varname.length > 0) && (expression.length > 0))
	{
		node_attributes[varname] = units;
		load_node_data(varname, units, expression)
	}
	else
		alert('Both a variable name and an expression are required')
}

function open_dialog(title, str, width, resize_func)
{	
    dlg = $( "#dialog" )
    dlg.dialog('option', 'title', title)
    dlg.dialog('option', 'width', width)
    dlg.html(str) 
    dlg.on('dialogresize', resize_func)
    dlg.dialog("open")
}

function load_corridor_travel_time_dialog()
{
	open_corridor_travel_time_dialog('Corridor Travel Time', 'Do It', 'load_corridor_travel_times_from_dialog');
}

function load_corridor_travel_times_from_dialog(n, i)
{
 	close_dialog();
	load_corridor_travel_times(n, i);
}
 
function busroute_selection()
{	
	$('#busroute_view_options').show();	

	var busroutes = $('#busroute_checkboxes .busroute_checkbox:checked');
	if (busroutes.length > 0)
	{
		var dataset_name = $('#busroute_data_select').val();
		var dataset = corridor_travel_times[dataset_name];
		
		current_timestep = 0;
		number_of_timesteps = dataset.data.length;
		
		if (number_of_timesteps > 1)
		{		
			theAnimator.SetTimeFrame(dataset.timestamps[0], dataset.timestamps[dataset.timestamps.length - 1]);
			theAnimator.SetTimesteps(dataset.timestamps);
			theAnimator.Do(0);
		}
		else
			dataLayer_redraw();
	
		theLinkColorMapper.SetRange(dataset.data_range[0], dataset.data_range[1]);
		theLinkSizeMapper.SetRange(dataset.data_range[0], dataset.data_range[1]);
	}
	dataLayer_redraw();
}

function set_aggregation(ev, t)
{
	if (ev.keyCode == 13) 
		$('.aggregation_interval').each(function (i, e) { e.value = t.value; });
}

var underLayer_is_visible = true;

function toggle_underLayer_visibility()
{
	underLayer_is_visible = !underLayer_is_visible;
	underLayer.display(underLayer_is_visible);
}

function text_input_on_enter(event, action) 
{
	var charCode = event.which || event.keyCode;
	if (charCode == '13')
	{
		action();
	}
}

function new_transitOD_origins()
{
	$('#transitOD_origins').val("");
	// $('#transitOD_doit').attr("disabled", "disabled");
	add_transitOD_origins();
}

function add_transitOD_origins()
{
	transitOD_mode = 0;
	dataLayer_redraw();
	enableSelection(transitOD_origin_selection_event, function(e) { dataLayer_redraw(); });
}

function transitOD_origin_selection_event(ev)
{	
	if (ev.feature.selectable)
	{
		ev.feature.selectable = false;
		txt = $('#transitOD_origins');
		if (txt.val() == "")
			txt.val(ev.feature.feature_id);
		else
			txt.val(txt.val() + ',' + ev.feature.feature_id);
	}

	// if ($('#transitOD_origins').val() != "" && $('#transitOD_destinations').val() != "")
	    // $('#transitOD_doit').removeAttr("disabled");
	
}

function new_transitOD_destinations()
{
	$('#transitOD_destinations').val("");
	// $('#transitOD_doit').attr("disabled", "disabled");
	add_transitOD_destinations()
}

function add_transitOD_destinations()
{
	transitOD_mode = 1;
	dataLayer_redraw();
	enableSelection(transitOD_destination_selection_event, function(e) { dataLayer_redraw(); });
}

function transitOD_destination_selection_event(ev)
{	
	if (ev.feature.selectable)
	{
		ev.feature.selectable = false;
		txt = $('#transitOD_destinations');
		if (txt.val() == "")
			txt.val(ev.feature.feature_id);
		else
			txt.val(txt.val() + ',' + ev.feature.feature_id);
	}

	// if ($('#transitOD_origins').val() != "" && $('#transitOD_destinations').val() != "")
	    // $('#transitOD_doit').removeAttr("disabled");
	
}

function transitOD_doit()
{
	transitOD_data = 0;
	disableSelection();
	
	interval = $('#linkpath_view_options .aggregation_interval').val();
	method = $('[name=linkpath_aggregation_type]:checked').val();
	
	urlString = '/visualizer/transitOD/' +  network_name + '/' +
			$("input[name=transitOD_aggregation]").filter(':checked').val() + '/'  +
			$('#transitOD_interval_start').val() + '/' +
			$('#transitOD_interval_end').val() + '/' +
			$('#transitOD_origins').val() + '/' +
			$('#transitOD_destinations').val();

	$.ajax({
		url: urlString,
		dataType : 'json',
		cache: false,
		success: receive_transitOD_data
		});
	
	transitOD_mode = 2;
	disableSelection();
	dataLayer_redraw();
}

function receive_transitOD_data(data)
{
	if (data['status'] != 'OK')
	{
		error_dialog('Transit OD error: ' + data['status']);
		return
	}

	transitOD_data = data;
		
	lmin = 99999999;
	lmax = 0;
	for (var l in transitOD_data['links'])
	{
		v = transitOD_data['links'][l];
		if (v > lmax) lmax = v;
		if (v < lmin) lmin = v;
	}
		
	omin = 99999999;
	omax = 0;
	for (var l in transitOD_data['origins'])
	{
		v = transitOD_data['origins'][l];
		if (v > omax) omax = v;
		if (v < omin) omin = v;
	}
	
	dmin = 99999999;
	dmax = 0;
	for (var l in transitOD_data['destinations'])
	{
		v = transitOD_data['destinations'][l];
		if (v > dmax) dmax = v;
		if (v < dmin) dmin = v;
	}
		
	transitOD_data['links_minmax'] = [lmin, lmax]
	transitOD_data['origins_minmax'] = [omin, omax]
	transitOD_data['destinations_minmax'] = [dmin, dmax]

	dataLayer_redraw();
}

function transit_doit()
{
	transit_data = 0;
	
	routes = []
	$('#route_options option').each(function(rindx, opt) {
		if (this.selected)
			routes.push(this.value);
	});
	
	start = $('#transit_interval_start').val();
	end   = $('#transit_interval_end').val();
	directions = [$('#transit_0').is(':checked') ? 1 : 0, $("#transit_1").is(':checked') ? 1 : 0].join(',');
	feeds = $('#transit_include_feeds').is(':checked') ? 1 : 0;

	urlString = '/visualizer/transit/' +  network_name + '/' +
			routes + '/' + start + '/' + end + '/' + directions + '/' + feeds;

	$.ajax({
		url: urlString,
		dataType : 'json',
		cache: false,
		success: receive_transit_data
		});
	
	dataLayer_redraw();
}

function receive_transit_data(data)
{
	if (data['status'] != 'OK')
		error_dialog('Link path error: ' + data['status']);
	else
	{
		str = ''
		for (var i in data['link_attrs'])
		{
			a = data['link_attrs'][i];
			str += '<option value=' + a + '>' + a + '</option>';
		}

		$('#transit_link_color_attr').html(str);
		$('#transit_link_size_attr').html(str);

		str = ''
		for (var i in data['node_attrs'])
		{
			a = data['node_attrs'][i];
			str += '<option value=' + a + '>' + a + '</option>';
		}
	
		$('#transit_node_color_attr').html(str);
		$('#transit_node_size_attr').html(str);

		node_map = {};

		amax = 0
		bmax = 0
		tmax = 0;
		for (var i in data['transit_passenger_nodedata'])
		{
			b = data['transit_passenger_nodedata'][i][1];
			a = data['transit_passenger_nodedata'][i][2];
			t = b + a;

			data['transit_passenger_nodedata'][i].push(t);
			if (b > bmax) bmax = b;
			if (a > amax) amax = a;
			if (t > tmax) tmax = t;

			node_map[data['transit_passenger_nodedata'][i][0]] = i;
			data['transit_passenger_nodedata'][i]['in'] = []
			data['transit_passenger_nodedata'][i]['out'] = []
		}

		lmax = 0;
		for (var i in data['transit_passenger_linkdata'])
		{
			l = data['transit_passenger_linkdata'][i][1];
			if (l > lmax)
				lmax = l;

			linkid = data['transit_passenger_linkdata'][i][0];
			link_index = network_linkid_to_index[linkid];
			feature = transit_link_features[link_index];
			
			s = feature['source'];
			d = feature['destination'];

			ms = node_map[s]
			if (ms != undefined)
				data['transit_passenger_nodedata'][ms]['out'].push(link_index);
				
			md = node_map[d]
			if (md != undefined)
				data['transit_passenger_nodedata'][md]['in'].push(link_index);
		}

		for (var i in data['transit_passenger_nodedata'])
		{
			node = data['transit_passenger_nodedata'][i];
			nodeid = node[0];
			node_index = network_nodeid_to_index[nodeid];
			feature = node_features[node_index];

			if (node['in'].length > 0 && node['out'].length > 0)
			{
				p0 = transit_link_features[node['in'][0]].path[0];
				p1 = transit_link_features[node['in'][0]].path[1];
				p2 = transit_link_features[node['out'][0]].path[1];
			}
			else
			{
				if (node['in'].length > 0) linkid = node['in'][0];
				else linkid = node['out'][0];

				p0 = transit_link_features[linkid].path[0];
				p1 = transit_link_features[linkid].path[1];
				p2 = [2*p1[0] - p0[0], 2*p1[1] - p0[1]];
			}

			perp = perpendicular([p0,p1,p2]);
			offx = xyzzy*latLon_scaling * perp[0];
			offy = xyzzy*latLon_scaling * perp[1];

			data['transit_passenger_nodedata'][i]['loc'] = [feature['location'][0] - offx, feature['location'][1] - offy];
		}

		transit_data = {
			'link_attr_data': data['link_attr_data'],
			'node_attr_data': data['node_attr_data'],
			'transit_passenger_linkdata': data['transit_passenger_linkdata'],
			'transit_passenger_linkdata': data['transit_passenger_linkdata'],
			'link_max': [lmax],
			'transit_passenger_nodedata': data['transit_passenger_nodedata'],
			'node_max': [bmax, amax, tmax],
			'feed_links': data['feed_links'],
		};

		dataLayer_redraw();
	}
}

function reset_transit()
{
	transit_data = 0;
	dataLayer_redraw();
}

function toggle_visibility(id) {
	 var e = document.getElementById(id);

	 if(id === 'ColorMapDiv') {
	 	if(e.children.length === 0 || (e.children.length > 0 && !e.children[0].hasChildNodes())) {
	 		e.style.display = 'none';
	 		return;
	 	}
	 }
 
	 if(e.style.display == 'block')
		e.style.display = 'none';
	 else
		e.style.display = 'block';

	if(id === 'view_options') {
		if(e.style.display == 'none') {
			document.getElementById("options_visibility_toggle").className = 'glyphicon glyphicon-chevron-right';	
		}
		else {
			document.getElementById("options_visibility_toggle").className = 'glyphicon glyphicon-chevron-left';	
		}
	}

}

function set_visible(id) {
	var e = document.getElementById(id);
		e.style.display = 'block';
	if(id === 'view_options') {
		document.getElementById("options_visibility_toggle").className = 'glyphicon glyphicon-chevron-left';
	}
}

function set_invisible(id) {
	 var e = document.getElementById(id);
		e.style.display = 'none';
}

