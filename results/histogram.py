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

def plot(data, bins):
	fig = plt.figure(figsize=(6, 4), dpi=150)
	ax = fig.add_subplot(111)

	# histogram our data with numpy
	n, bins = np.histogram(data, bins, range=(0, 6000))

	# get the corners of the rectangles for the histogram
	left = np.array(bins[:-1])
	right = np.array(bins[1:])
	bottom = np.zeros(len(left))
	top = bottom + n


	# we need a (numrects x numsides x 2) numpy array for the path helper
	# function to build a compound path
	XY = np.array([[left,left,right,right], [bottom,top,top,bottom]]).T

	# get the Path object
	barpath = path.Path.make_compound_path_from_polys(XY)

	# make a patch out of it
	patch = patches.PathPatch(barpath, facecolor='blue', alpha=0.8)
	ax.add_patch(patch)

	# update the view limits
	ax.set_xlim(left[0], right[-1])
	#ax.set_ylim(bottom.min(), top.max())
	ax.set_ylim(0, 4000)

	# labels
	ax.tick_params(axis='both', which='major', labelsize=10)
	ax.set_xlabel('Lifespan', fontsize=12)
	ax.set_ylabel('Count', fontsize=12)

	return fig

if __name__ == '__main__':
	import os.path
	import sys
	data = np.loadtxt(sys.argv[1])
	print(sys.argv[1])
	print(np.mean(data))
	print(np.median(data))
	fig = plot(data, 40)
	fig.savefig('{:}.png'.format(os.path.splitext(sys.argv[1])[0]), dpi=150)

