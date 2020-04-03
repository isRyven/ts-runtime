cmake_minimum_required(VERSION 3.12)
project(ts-runtime VERSION 0.1.0 LANGUAGES C CXX)

add_subdirectory(deps/dumbjs)
target_compile_definitions(dumbjs PRIVATE NOSTACKCHECKS)
add_subdirectory(deps/un7z)

add_executable(tsr main.c)
