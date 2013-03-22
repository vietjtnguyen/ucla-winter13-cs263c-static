#!/bin/bash

./histogram.py combined/baseline-nd.txt
./histogram.py combined/baseline-ns.txt
./histogram.py combined/baseline-rd.txt
./histogram.py combined/baseline-rs.txt
./histogram.py combined/evolved-nd.txt
./histogram.py combined/evolved-ns.txt
./histogram.py combined/evolved-rd.txt
./histogram.py combined/evolved-rs.txt
./histogram.py combined/experiment-ns-in-rd.txt
./histogram.py combined/experiment-rd-in-ns.txt
./histogram.py combined/experiment-rd-in-rs.txt
./histogram.py combined/experiment-rs-in-rd.txt
