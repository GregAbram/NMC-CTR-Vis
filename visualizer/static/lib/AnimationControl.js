function AnimationControl(f)
{
    this.create = function()
    {
		this.ui = jQuery('<div/>', {style: 'height: 55px; width: 300px; margin-top: 8px; margin-right: 10px; display: none;', class: 'control_panel'});
	
		this.buttonbox = jQuery('<div/>', 
						{
						  style: 'float: left; width: 72px; height: 24px; top: 6px; left: 8px; position: relative;'
						});
		this.ui.append(this.buttonbox);
	
		this.display_text = jQuery('<input/>',
						{
						  type:  'text',
							value: '-',
						  style: 'text-align: right; float: left; width: 170px; height: 24px; top: 3px; left: 12px; position: relative;',
						});
		this.display_text.prop('disabled', 'true');
		this.display_text.on('keypress', this, function(ev) {if (ev.keyCode == 13) ev.data.display_text_entered();});
		this.ui.append(this.display_text);
	
		this.expand_button = jQuery('<input/>',
						{
						  style: "top: 4px; left: 16px; position: relative",
						  type:  "image",
						  src:   open_png
						}
					).on('click', this, function(ev){ ev.data.expand(); });
	
		this.ui.append(this.expand_button);
	
		this.start_stop_button = jQuery('<input/>',
						{
						  style: "float:left; top:-2px;position:relative",
						  type:  "image",
						  src:   play_png
						}
					).on('click', this, function(ev){ ev.data.startstop(); });
		this.buttonbox.append(this.start_stop_button);
	
		this.single_step_button_backward = jQuery('<input/>',
						{
						  style: "float:left;top:-2px;position:relative",
						  type:  "image",
						  src:   step_backward_png
						}
					).on('click', this, function(ev){ ev.data.singlestep(-1); });
		this.buttonbox.append(this.single_step_button_backward);
	
		this.single_step_button_forward = jQuery('<input/>',
						{
						  style: "float:left;top:-2px;position:relative",
						  type:  "image",
						  src:   step_forward_png
						}
					).on('click', this, function(ev){ ev.data.singlestep(1); });
		this.buttonbox.append(this.single_step_button_forward);
	
		this.slider = jQuery('<div/>',
						{
						   id:    "animator_slider",
               style: "float: left; left: 13px; position: relative; top: 10px; width: 274px; height: 10px;"
						});
		this.ui.append(this.slider);
	
		this.expansion_container = jQuery('<div/>', {style: 'top: 20px; position: relative; width: 300px; height: 165px; background-color: grey; display: none'});
		this.ui.append(this.expansion_container);
	
		this.current_label = jQuery('<label/>', {style: "float: left; position: relative; left: 5px; width: 45%; top: 0px"});
		this.current_label.html('Current:');
		this.current_text = jQuery('<input/>',
						{
						    type:  "text",
						    value: "0",
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative",
						});
		this.current_text.on('keypress', this, function(ev) {if (ev.keyCode == 13) ev.data.change_text_value();});
		this.expansion_container.append(this.current_label);
		this.expansion_container.append(this.current_text);
	
		this.count_label = jQuery('<label/>', {style: "float: left; position: relative; width: 45%; left: 5px; top: 0px"});
		this.count_label.html('Count:');
		this.count_text = jQuery('<input/>',
						{
						    type:  "text",
						    value: 100,
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative"
						});
		this.expansion_container.append(this.count_label);
		this.expansion_container.append(this.count_text);
	
		this.skip_label = jQuery('<label/>', {style: "float: left; position: relative; width: 45%; left: 5px; top: 0px"});
		this.skip_label.html('Skip:');
		this.skip_text = jQuery('<input/>',
						{
						    type:  "text",
						    value: "0",
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative"
						});
		this.expansion_container.append(this.skip_label);
		this.expansion_container.append(this.skip_text);
	
		this.delay_label = jQuery('<label/>', {style: "float: left; position: relative; width: 45%; left: 5px; top: 0px"});
		this.delay_label.html('Interval:');
		this.delay_text = jQuery('<input/>',
						{
						    type:  "text",
						    value: "0",
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative"
						});
		this.expansion_container.append(this.delay_label);
		this.expansion_container.append(this.delay_text);
	
		this.t_first_label = jQuery('<label/>', {style: "float: left; position: relative; width: 45%; left: 5px; top: 0px"});
		this.t_first_label.html('MinTime:');
		this.t_first_text = jQuery('<input/>',
						{
						    type:  "text",
						    value: 0,
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative"
						});
		this.expansion_container.append(this.t_first_label);
		this.expansion_container.append(this.t_first_text);
	
		this.t_last_label = jQuery('<label/>', {style: "float: left; position: relative; width: 45%; left: 5px; top: 0px"});
		this.t_last_label.html('MaxTime:');
		this.t_last_text = jQuery('<input/>',
						{
						    type:  "text",
						    value: 1,
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative"
						});
		this.expansion_container.append(this.t_last_label);
		this.expansion_container.append(this.t_last_text);
	
		this.slider.slider();
		this.slider.slider('option', 'min',   0);
		this.slider.slider('option', 'max',   this.count_text.val()-1);
		this.slider.slider('value', 32);
		this.slider.on('slidechange', this,   function(ev, ui) {ev.data.change_slider_value();});

		this.base_datetime_label = jQuery('<label/>', {style: "float: left; position: relative; width: 45%; left: 5px; top: 0px"});
		this.base_datetime_label.html('Date/Time:');
		this.base_datetime_text = jQuery('<input/>',
						{
						    type:  "text",
								value: "0",
						    style: "clear: both; width: 40%; top: -4px; left: 10px; position: relative"
						});
		this.expansion_container.append(this.base_datetime_label);
		this.expansion_container.append(this.base_datetime_text);
    }

    this.GetUI = function()
    {
		return this.ui;
    }

    this.expand = function()
    {
		if (this.expand_button.attr('src') == open_png)
		{
		    this.expand_button.attr('src', close_png);
		    this.expansion_container.show();
		}
		else
		{
		    this.expand_button.attr('src', open_png);
		    this.expansion_container.hide();
		}
	}

    this.startstop = function()
    {
		current_button = this.start_stop_button.attr('src');
		if (current_button == play_png)
		{
			this.start_stop_button.attr('src', stop_png);
			if (parseInt(this.count_text.val()) >= parseInt(this.current_text.val()))
				this.Do(0);
			this.running = true;
		    this.next();
		}
		else
		{
		    this.running = false;
		    this.start_stop_button.attr('src', play_png);
		}
    }

    this.next = function()
    {
		var skip = parseInt(this.skip_text.val());
	  	var n_tsteps = parseInt(this.count_text.val());
	
		var n = parseInt(this.current_text.val()) + this.direction*(skip + 1);
	
		if (n < 0 || n >= n_tsteps)
		{
		    if (this.running)
			this.startstop();
		}
		else
		{
		    var tStart = (new Date).getTime();
		    this.current_text.val(n);
		    this.slider.slider('value', n);
		    this.display_string();
		    var tNow = (new Date).getTime();
	
		    if (this.running)
		    {
		    	this.function(n);
		    	
				var delay = this.delay_text.val();
				var tRemaining = parseFloat(delay - (tNow - tStart));
				if (tRemaining < 0) tRemaining = 0;
				setTimeout(this.next.bind(this), tRemaining);
		    }
		}
    }

    this.change_text_value = function()
    {
		if (! this.running)
		{
			this.display_string();
	
		    // If the slider value is wrong, then we fix it.  That'll call
		    // change_slider_value, and the function will be called from there.
		    // If they already match, we do the selected frame.
		    var n = parseInt(this.current_text.val());
	
		    if (this.slider.slider('value') != n)  
				this.slider.slider('value', n);   
		    else
				this.function(n);
		}
    }

    this.display_text_entered = function()
    {
		var val      = parseFloat(this.display_text.val());
  		var n_tsteps = parseInt(this.count_text.val());
        var min_time = parseFloat(this.t_first_text.val());
        var max_time = parseFloat(this.t_last_text.val());
		if (val < min_time) val = min_time;
		else if (val > max_time) val = max_time;

        var i = Math.floor(((val - min_time)/(max_time - min_time)) * n_tsteps + 0.5);
		this.current_text.val(i);
		this.change_text_value();
    }

    this.change_slider_value = function()
    {
		if (! this.running)
		{
		    var n = this.slider.slider('value');
	
		    // Similarly, if the slider value is wrong, then we fix it.  
	
		    if (n != this.current_text.val())
		    {
				this.current_text.val(n);
				this.change_text_value();
				this.display_string();
		    }
		    else
			this.function(n);
		}
    }

		this.set_datetime = function(epochSecs) 
		{
			if (epochSecs == 0)
				this.base_datetime_text.val(0);
			else
				this.base_datetime_text.val(new Date(epochSecs * 1000));
		}
			
    this.display_string = function()
    {
			// tsteps array is in MINUTES - time string calculated from MILLISECONDS - hence the * 60000
  		var now = this.tsteps[this.current_text.val()] * 60000;
			var base = this.base_datetime_text.val();
			if (base != 0)
			{
				var base = new Date(base);
				var nowStr  = new Date(base.getTime() + now);
				this.display_text.val(nowStr);
			}
			else
				this.display_text.val(now);
    }

    this.singlestep = function(inc)
    {
		this.direction = inc;
		this.next();
		this.direction = 1;
    }

    this.Do = function(n)
    {
		this.current_text.val(n);
		this.change_text_value();
		this.display_string();
    }

	this.SetTimesteps = function(tsteps)
	{
		this.tsteps = tsteps;
		
		n = this.tsteps.length;
		this.count_text.val(n);	
		this.slider.slider('option', 'max', n-1);
	}
	
    this.SetTimeFrame = function(t0, tn)
    {
    	this.t_first_text.val(t0);
    	this.t_last_text.val(tn);
    }
    
    this.Show = function()
    {
    	this.ui.show();
    }
    
    this.Hide = function()
    {
    	this.ui.hide();
    }
    
    this.SetInterval = function(i)
    {
    	this.interval = i;
    }

    this.function    = f;
    this.running     = false;
    this.direction   = 1;
    this.interval    = 1;

    this.create();
}

