function perpendicular(pts)
{
	var v0 = vnorm(vsub(pts[1], pts[0]));
	var v1 = vnorm(vsub(pts[2], pts[1]));
	
	return vperp(v0);
}


function offset_intermediate_vertex(d, pts, offs)
{
	var v0 = vnorm(vsub(pts[1], pts[0]));
	var v1 = vnorm(vsub(pts[2], pts[1]));
	
	var v = vperp(v0);
	var a = vangle(v0, v1);
	
	var s;
	if (a < 0.0001)
		s = 0;
	else if (a < 3.141526)
	{
		s = d / Math.tan((3.1415926 - a)/2);
		if (a < 3.1)
			offs.push(vadd(pts[1], vadd(vscale(v0, -s), vscale(vp, d))));
		else
		{
			p = vadd(pts[1], vadd(vscale(v0, -s), vscale(vp, d)));
			if (vlen(vsub(p, pts[1])) < d)
				offs.push(vadd(pts[1], vadd(vscale(v0, -s), vscale(vp, d))));
		}
	}
	else
	{
		var k = Math.floor((2 + 8*(a/(2*3.1415926))));
		var angle_step = -(2*3.1415926 - a) / (k-1);
		for (var j = 0; j < k; j++)
		{
			offs.push(vadd(pts[1], vscale(vp, d)));
			vp = vrot(vp, angle_step);
		}
	}
}

function offset_path(pts, d)
{ 
	var offs = [];
	
	v = vnorm(vsub(pts[1], pts[0]));
	
	vp = vperp(v);
	offs.push(vadd(pts[0], vscale(vp, -d)));
	
	for (var i = 1, k = pts.length-1; i < k; i++)
	{
		s = pts.slice(i-1,i+2);
		offset_intermediate_vertex(-d, s, offs);
	}
	
	v = vsub(pts[pts.length-1], pts[pts.length-2]);
	vp = vperp(vnorm(v));
	offs.push(vadd(pts[pts.length-1], vscale(vp, -d)));
	
	return offs;
}

function offset_links()
{
	txt = document.getElementById("link_offset").value;
	alert(txt);
}

function vlen(v)
{
	return Math.sqrt(v[0]*v[0] + v[1]*v[1]);
}

function vnorm(v)
{
	var l = vlen(v);
	return [v[0]/l, v[1]/l];
}

function vangle0(a)
{
	var ang;
	
	if (a[0] == 0.0) 
	{
		if (a[1] > 0)
			ang = 3.1415926 / 2.0;
		else
			ang = -3.1415926 / 2.0;
	}
	else
		ang = Math.atan(a[1] / a[0]);
	
	if (a[0] >= 0) 
	{
		if (a[1] >= 0)
			ang = ang;
		else
			ang = 2*3.1415926 + ang;
	}	
	else if (a[1] >= 0)
		ang = 3.1415926 + ang;
	else
		ang = 3.1415926 + ang;
	
	return ang;
}

function vangle(a, b)
{
	var d = vangle0(b) - vangle0(a);
	if (d < 0)
		d = d + 2*3.1415926;
	return d;
}

function vadd(p, q)
{
	return [p[0]+q[0], p[1]+q[1]];
}

function vsub(p, q)
{
	if ((p == null) || (q == null))
		alert('oh, snap!')
	return [p[0] - q[0], p[1] - q[1]];
}

function vperp(p)
{
	return [-p[1], p[0]];
}

function vscale(p, s)
{
	return [s * p[0], s * p[1]];
}

function vrot(v, a)
{
	var c = Math.cos(a);
	var s = Math.sin(a);
	return [c*v[0] - s*v[1], s*v[0] + c*v[1]];
}

function offsetLinks(e)
{
	if (e.keyCode == 13)
		redraw();
}
