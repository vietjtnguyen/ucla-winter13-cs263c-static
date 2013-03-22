#!/usr/bin/python
"""
This example shows how to use a path patch to draw a bunch of
rectangles.  The technique of using lots of Rectangle instances, or
the faster method of using PolyCollections, were implemented before we
had proper paths with moveto/lineto, closepoly etc in mpl.  Now that
we have them, we can draw collections of regularly shaped objects with
homogeous properties more efficiently with a PathCollection.  This
example makes a histogram -- its more work to set up the vertex arrays
at the outset, but it should be much faster for large numbers of
objects
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.path as path

def plot(baseline_data, evolved_data, experiment_data, x_range, y_range, num_of_bins):
	fig = plt.figure(figsize=(6, 4), dpi=150)
	ax = fig.add_subplot(111)

	# histogram our data with numpy
	baseline_n, bins = np.histogram(baseline_data, num_of_bins, range=x_range)
	evolved_n, bins = np.histogram(evolved_data, num_of_bins, range=x_range)
	experiment_n, bins = np.histogram(experiment_data, num_of_bins, range=x_range)

	# get the corners of the rectangles for the histogram
	def create_patch(histogram_data, bottom, facecolor, alpha):
		left = np.array(bins[:-1])
		right = np.array(bins[1:])
		top = bottom + histogram_data
		#XY = np.array([[left,left,right,right], [bottom,top,top,bottom]]).T
		XY = np.array([[bottom,top,top,bottom], [left,left,right,right]]).T
		barpath = path.Path.make_compound_path_from_polys(XY)
		patch = patches.PathPatch(barpath, facecolor=facecolor, alpha=alpha)
		return patch

	#ax.add_patch(create_patch(baseline_n, np.zeros(len(baseline_n)), facecolor='gray', alpha=0.05))
	#ax.add_patch(create_patch(evolved_n, baseline_n, facecolor='red', alpha=0.05))
	#ax.add_patch(create_patch(experiment_n, evolved_n + baseline_n, facecolor='blue', alpha=0.05))

	x = bins[:-1] + (x_range[1]-x_range[0])/num_of_bins/2.0
	totals = np.array(baseline_n + evolved_n + experiment_n, dtype='f4')
	baseline_y = baseline_n / totals
	evolved_y = evolved_n / totals
	experiment_y = experiment_n / totals

	ax.add_patch(create_patch(experiment_y, np.zeros(len(baseline_y)), facecolor='blue', alpha=0.75))
	ax.add_patch(create_patch(baseline_y, experiment_y, facecolor='gray', alpha=0.75))
	ax.add_patch(create_patch(evolved_y, experiment_y + baseline_y, facecolor='red', alpha=0.75))

	#ax.plot(x, ( baseline_n ) / y_range[1], color='gray', linewidth=2.0)
	#ax.plot(x, ( evolved_n + baseline_n ) / y_range[1], color='red', linewidth=2.0)
	#ax.plot(x, ( experiment_n + baseline_n + evolved_n ) / y_range[1], color='blue', linewidth=2.0)

	#ax.plot(np.array(x_range), np.ones(2) * y_range[1] * 0.25, color='black', alpha=0.25, linewidth=1.0)
	#ax.plot(np.array(x_range), np.ones(2) * y_range[1] * 0.5, color='black', alpha=0.25, linewidth=1.0)
	#ax.plot(np.array(x_range), np.ones(2) * y_range[1] * 0.75, color='black', alpha=0.25, linewidth=1.0)
	ax.plot(np.ones(2) * y_range[1] * 0.25, np.array(x_range), color='black', alpha=0.25, linewidth=1.0)
	ax.plot(np.ones(2) * y_range[1] * 0.5, np.array(x_range), color='black', alpha=0.25, linewidth=1.0)
	ax.plot(np.ones(2) * y_range[1] * 0.75, np.array(x_range), color='black', alpha=0.25, linewidth=1.0)

	# update the view limits
	#ax.set_xlim(x_range[0], x_range[1])
	#ax.set_ylim(y_range[0], y_range[1])
	ax.set_ylim(x_range[0], x_range[1])
	ax.set_xlim(y_range[0], y_range[1])

	# labels
	ax.tick_params(axis='both', which='major', labelsize=10)
	ax.set_ylabel('Lifespan', fontsize=12)
	ax.set_xlabel('Proportion', fontsize=12)

	return fig

if __name__ == '__main__':
	import os.path
	import sys
	baseline_data = np.loadtxt(sys.argv[1])
	evolved_data = np.loadtxt(sys.argv[2])
	experiment_data = np.loadtxt(sys.argv[3])
	fig = plot(baseline_data, evolved_data, experiment_data, (0000.0, 6000.0), (0.0, 1.0), 6)
	fig.savefig('{:}-c.png'.format(os.path.splitext(sys.argv[3])[0]), dpi=150)

