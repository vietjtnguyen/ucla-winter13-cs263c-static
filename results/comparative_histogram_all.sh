#!/bin/bash

./comparative_histogram.py combined/baseline-ns.txt combined/evolved-ns.txt combined/experiment-rd-in-ns.txt
./comparative_histogram.py combined/baseline-rd.txt combined/evolved-rd.txt combined/experiment-ns-in-rd.txt
./comparative_histogram.py combined/baseline-rs.txt combined/evolved-rs.txt combined/experiment-rd-in-rs.txt
./comparative_histogram.py combined/baseline-rd.txt combined/evolved-rd.txt combined/experiment-rs-in-rd.txt
