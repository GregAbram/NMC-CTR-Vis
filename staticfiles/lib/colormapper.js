function ValueMapper(title, redraw)
{
	var units = ''
		
	this.SetUnits = function(u)
	{
		this.units = u;
	}
		
	this.GetActiveRange = function()
	{
		return [this.current_min, this.current_max]
	}
	
    this.SetRange = function(m, M)
    {
   		this.range_min   = Number(m);
   		this.current_min = Number(m);
   		this.range_max   = Number(M);
  		this.current_max = Number(M);
    }
   
    this.SetSubRange = function(m, M)
    {
   		this.current_min = Number(m);
   		this.current_max = Number(M);
    }

	this.Map = function(v)
	{
		if ((v >= this.current_min) && (v <= this.current_max))
		{
			range = this.max_value - this.min_value;
			delta = (Number(v) - this.current_min) / (this.current_max - this.current_min);
			v = this.min_value + delta*range;
			return v;
			
		}
	}   
	
	this.GetAnnotation = function()
	{       
		var div = jQuery('<div/>', {style: 'display: inline-block; text-align: center;'});
		
		if (this.units != undefined && this.units != "")
			div.append(jQuery('<div/>', {style: 'margin: 0px auto;'}).html("Units: " + this.units));
		
		div.append(jQuery('<div/>',
						{
							style: 'height: 16px; top: 5px; float: left; position: relative',
				  		}
				        ).html('Domain: (' + Number(this.range_min).toFixed(2) + ')'));
		
		min_txt = jQuery('<input>', 
						{
							type: 'text',
							id:   'min_value',
							value: Number(this.current_min).toFixed(2),
							style: 'width: 48px; float: left; top: 0px; position: relative',
						}
						);
		
		min_txt.on('keydown', this, function(ev){
						var val = parseFloat($(this).val());
						if (ev.keyCode == 13 && !isNaN(val))
						{
							ev.data.current_min = val;
							ev.data.Redraw();
						}
						});
		
		div.append(min_txt);
		
		max_txt = jQuery('<input>', 
						{
							type: 'text',
							id:   'max_value',
							value: Number(this.current_max).toFixed(2),
							style: 'width: 48px; float: left; top: 0px; position: relative',
						}
						);	
		
		max_txt.on('keydown', this, function(ev){
						var val = parseFloat($(this).val());
						if (ev.keyCode == 13 && !isNaN(val))
						{
							ev.data.current_max = val;
							ev.data.Redraw();
						}
						});
		
		div.append(max_txt);
			
		div.append(jQuery('<div/>',
						{
							style: 'height: 16px; top: 5px; float: left; position: relative',
				   		}
				   		).html(' (' + Number(this.range_max).toFixed(2) + ') Range: '));
				   
		min_txt = jQuery('<input>', 
						{
							type: 'text',
							id:   'min_value',
							value: Number(this.min_value).toFixed(2),
							style: 'width: 48px; float: left; top: 0px; position: relative',
						}
						);
		
		min_txt.on('keydown', this, function(ev){
								var val = parseFloat($(this).val());
								if (ev.keyCode == 13 && !isNaN(val))
								{
									ev.data.min_value = val;
									ev.data.Redraw();
								}
				  			});
		
		div.append(min_txt);
		
		max_txt = jQuery('<input>', 
						{
							type: 'text',
							id:   'max_value',
							value: Number(this.max_value).toFixed(2),
							style: 'width: 48px; float: left; top: 0px; position: relative',
						}
						);
		
		max_txt.on('keydown', this, function(ev){
								var val = parseFloat($(this).val());
								if (ev.keyCode == 13 && !isNaN(val))
								{
									ev.data.max_value = val;
									ev.data.Redraw();
								}
				  			});
		
	    div.append(max_txt);
					
		return div;
	}
	
	this.SetValueRange = function(m, M)
	{
		this.min_value = Number(m);
		this.max_value = Number(M);
	}
	
	this.range_min   = 0.0;
	this.current_min = 0.0;

	this.range_max   = 1.0;
	this.current_max = 1.0;
	
	this.min_value   = 0.0;
	this.max_value 	 = 1.0;
	
	this.Redraw = redraw;
}

function ColorMapper(title, redraw)
{
	var units = ''
		
	this.SetUnits = function(u)
	{
		this.units = u;
	}

	this.GetActiveRange = function()
	{
		return [this.current_min, this.current_max]
	}
	
    this.SetRange = function(m, M)
    {
       this.range_min   = Number(m);
       this.current_min = Number(m);
       this.range_max   = Number(M);
       this.current_max = Number(M);
    }
   
    this.SetSubRange = function(m, M)
    {
       this.current_min = Number(m);
       this.current_max = Number(M);
    }

    this.GetAnnotation = function()
    {
		var div = jQuery('<div/>', {style: 'display: inline-block; text-align: center;'});
		
		if (this.units != undefined && this.units != "")
			div.append(jQuery('<div/>', {style: 'margin: 0px auto;'}).html("Units: " + this.units));
		
	    div.append(jQuery('<div/>',
						{
							style: 'height: 16px; top: 5px; float: left; position: relative',
				  		}
				        ).html('Domain: (' + Number(this.range_min).toFixed(2) + ')'));

	    
       var div1 = jQuery('<div/>', {
			   	style: 'float: left',
			});
	
	   var min_txt = jQuery('<input>', {
				type: 'text',
				id:   'min_value',
				value: Number(this.current_min).toFixed(2),
				style: 'width: 48px; float: left; top: 0px; position: relative',
			});
			
	   min_txt.on('keydown', this, function(ev){
					var val = $(this).val();
					if (ev.keyCode == 13 && !isNaN(val))
					{
						ev.data.current_min = parseFloat(val);
						ev.data.Redraw();
					}
				  });


	   var label = jQuery('<div/>', {
				style: 'height: 16px; top: 5px; float: left; position: relative',
			}).html('(' + Number(this.range_min).toFixed(2) + ')');


	   div1.append(label);
	   div1.append(min_txt);

       var div2 = jQuery('<div/>', {
			    style: 'float: left',
		    });
	
	   var max_txt = jQuery('<input>', {
				type: 'text',
				id:   'max_value',
				value: Number(this.current_max).toFixed(2),
				style: 'width: 48px; float: left; top: 0px; position: relative',
			});
			
	   max_txt.on('keydown', this, function(ev){
					var val = $(this).val();
					if (ev.keyCode == 13 && !isNaN(val))
					{
						ev.data.current_max = parseFloat(val);
						ev.data.Redraw();
					}
				  });


	   var label = jQuery('<div/>', {
				style: 'height: 16px; top: 5px; float: left; position: relative',
			}).html('(' + Number(this.range_max).toFixed(2) + ')');

	   div2.append(max_txt);
	   div2.append(label);

       cbar = jQuery('<div>', { style: 'width: 256px; float: left; position: relative;'});
       cbar.bind('click', jQuery.proxy(function(event) {this.OpenDialog(this.Redraw);}, this));
           
       cbar.append(this.ColorBar(this.selected_colormap));
       
       div.append(div1);
       div.append(cbar);
       div.append(div2);

       return div;
    }

    this.OpenDialog = function(onDone)
    {
       this.dlg.on('dialogclose', onDone);
       this.dlg.dialog('open');
    }

    this.Hexstr = function(f)
    {
       var h = Number((f*255).toFixed()).toString(16);
       if (h.length == 1) h = '0' + h;
       return h;
    }

    this.ColorString = function(r, g, b)
    {
       return '#' + this.Hexstr(r) + this.Hexstr(g) + this.Hexstr(b);
    }

    this.LookUp = function(map, v)
    {
		v = Math.floor(v * this.quant);
		if (v == this.quant)
			v -= 1;

		v = (v + 0.5) * (1 / this.quant);
 
		if (v == 1.0)
	  		return map[1][map[1].length-1]
		else
		{
	    	for (var i = 1; i < map[0].length && map[0][i] < v; i++);
	    		if (map[0][i] == v)
	    			c = map[1][i];
	    		else
	    		{
	    			off = (v - map[0][i-1]) / (map[0][i] - map[0][i-1]);
	    			c =  map[1][i-1] + off*(map[1][i] - map[1][i-1]);
	    		}
		   	return c;
		}
    }

    this.Apply = function(w, v)
    {
		if (v >= this.current_min && v <= this.current_max)
		{
			if (this.current_min == this.current_max)
				vv = 0;
		    else
		    	vv = (v - this.current_min) / (this.current_max - this.current_min);
   
	       var r = this.LookUp(cmaps[w]['r'], vv);
	       var g = this.LookUp(cmaps[w]['g'], vv);
	       var b = this.LookUp(cmaps[w]['b'], vv);
	       var color = this.ColorString(r, g, b);
	       return color;
  		}
  	}

    this.Map = function(v)
    {
		if ((v >= this.current_min) || (v <= this.current_max))
			return this.Apply(this.selected_colormap, v);
    }

   this.SetQuantization = function(n)
   {
      if (isNaN(n))
      {
	     this.dlg.html(this.quant);
      }
      else
      {
	     this.quant = n;
	     this.DrawColormapDialog();
      }
    }

    this.ColorBar = function(cmap)
    {
	   var canvas = jQuery('<canvas></canvas>', {});
	   canvas.attr('width', '256');
	   canvas.attr('height', '24');

	   var d = 1.0 / this.quant;
	   var blocksize = 256 / this.quant;

       var ctx = canvas[0].getContext('2d');

	   var d   = ((this.current_max - this.current_min) / this.quant);
	   var v   = this.current_min + d / 2.0;
	   for (var i = 0; i < this.quant; i ++)
	   {
	      ctx.fillStyle = this.Apply(cmap, v);
	      ctx.fillRect(i*blocksize, 0, blocksize, 256);
	      v = v + d;
	   }

	   return canvas;
    }

    this.DrawColormapDialog = function()
    {
	   this.dlg.empty();

	   var panel = jQuery('<div/>', {id: 'panel', style: 'margin: 0; padding: 0; border: 0; width: 349px'});
	   this.dlg.append(panel);

	   for (i in Object.keys(cmaps))
	   {
	      var this_cmap = Object.keys(cmaps)[i]

	      if (this_cmap == this.selected_colormap)
	         isChecked = true;
	      else
	         isChecked = false;

	       var check = jQuery('<input>', {
	    			    type: 'radio',
	    			    name: 'colormap-radio',
				    checked:  isChecked,
	    			    value: this_cmap,
				    style: 'height: 16px; float: left; width: 8px',
				});
	    
	       check.on('click', this, function(ev){if ($(this).is(':checked')) ev.data.selected_colormap = $(this).attr('value');});

	       var cbar = jQuery('<div/>', {
				    style: 'float: left',
				});

	       cbar.append(this.ColorBar(this_cmap));

	       var label = jQuery('<div/>', {
				    style: 'width: 64px; height: 16px; fontSize: 8px; top: 0px; position: relative; float: left;',
				}).html(this_cmap);

	       var div = jQuery('<div/>', {
				   id: 'ColormapDialog_row',
				   style: 'height: 24px; padding: 0; margin: 0; 310px;',
				});

	       div.append(check);
	       div.append(label);
	       div.append(cbar);
	    
	       panel.append(div);
	   }

	   var div = jQuery('<div/>', {style: 'height: 12px;'});

	   var div2 = jQuery('<div/>', {
				    style: 'float: left; top: 5px; width: auto; position: relative;',
				}).html('Quantize: ');

   	   var quant = jQuery('<input>', {
				    id: 'quant-text',
				    type: 'text',
				    value: this.quant,
				    style: 'float: left; position: relative; left: 5px; width: 48px',
				});

	   quant.on('keydown', this, function(ev){
					var val = $(this).val();
					if (ev.keyCode == 13 && !isNaN(val))
						ev.data.SetQuantization(val);
				  });

	   div.append(div2);
	   div.append(quant);
	   div.append(div);

	   panel.append(div);
   }

   this.Redraw = redraw;
   
   this.selected_colormap = Object.keys(cmaps)[0];
   this.quant = 256;
   
   this.range_min   = 0.0;
   this.current_min = 0.0;

   this.range_max   = 1.0;
   this.current_max = 1.0;

   this.dlg = jQuery('<div/>', {
		style:  'padding: 0',
		title:  title,
		id:     'colormapper_dialog',
   	});
   	
   $('body').append(this.dlg);

   this.DrawColormapDialog();
 

   this.dlg.dialog({autoOpen: false, resizeable: false, modal: true, width: '375px'});
}
