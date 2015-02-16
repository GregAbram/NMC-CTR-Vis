from django.conf.urls import patterns, url

from visualizer import views

urlpatterns = patterns('',
    url(r'^visualize/(?P<database>.+)/', views.visualize),
    url(r'^list_datasets/(?P<database>.+)/', views.list_datasets),
    url(r'^load_network/(?P<database>.+)/', views.load_network),
    url(r'^load_data/(?P<network>.+)/(?P<varname>.+)/(?P<units>.+)/(?P<varstring>.+)$', views.load_data),
    url(r'^load_OD_nodes/(?P<database>.+)/(?P<do_origins>.+)$', views.load_OD_nodes),
    url(r'^load_OD_paths/(?P<database>.+)/(?P<interval>.+)/(?P<aggregation>.+)/(?P<origins>.+)/(?P<destinations>.+)$', views.load_OD_paths),
    url(r'^load_OD_reached_nodes/(?P<database>.+)/(?P<given_origins>.+)/(?P<nodeids>.+)$', views.load_OD_reached_nodes),
    url(r'^load_OD_distribution_data/(?P<database>.+)/(?P<interval>.+)/(?P<given_origins>.+)/(?P<nodeids>.+)$', views.load_OD_distribution_data),
    url(r'^load_link_paths/(?P<database>.+)/(?P<interval>.+)/(?P<selected_links>.+)/(?P<agg>.+)/$', views.load_link_paths),
    url(r'^load_corridor_travel_times/(?P<database>.+)$', views.load_corridor_travel_times),
    url(r'^load_reachtime/(?P<database>.+)/(?P<origins>.+)/(?P<interval>.+)/(?P<contour_levels>.+)/(?P<wndw>.+)/(?P<width>.+)/(?P<clip>.+)/(?P<elim_passed>.+)/(?P<artery>.+)$', views.load_reachtime),
    url(r'^load_weighted_average/(?P<network>.+)/(?P<network2>.+)/(?P<weighted_values>.+)/(?P<volumes>.+)/(?P<aggregation>.+)/(?P<result_name>.+)$', views.load_weighted_average),
    url(r'^transit/(?P<database>.+)/(?P<routes>.+)/(?P<start>.+)/(?P<end>.+)/(?P<directions>.+)/(?P<with_feeders>.+)$', views.transit),
    url(r'^transitOD/(?P<database>.+)/(?P<aggregation>.+)/(?P<start>.+)/(?P<end>.+)/(?P<origins>.+)/(?P<destinations>.+)$', views.transitOD),
    url(r'^$', views.network_page, name='network_page'),
)   

