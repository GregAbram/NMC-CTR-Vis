function show_busy_indicator()
{
	if ($("body").has("#nmc_busy_spinner").length == 0)
	{
		$spinner = $("<div id=nmc_busy_spinner/>")
		$("body").append($spinner)
	}
	$("#nmc_busy_spinner").css("visibility", "visible");
}

function hide_busy_indicator()
{
	$("#nmc_busy_spinner").css("visibility", "hidden");
}

