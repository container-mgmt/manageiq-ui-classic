namespace :update do
  task :bower do
    Dir.chdir ManageIQ::UI::Classic::Engine.root do
      system("bower update --allow-root -F --config.analytics=false") || abort("\n== bower install failed ==")
    end
  end

  task :yarn do
    asset_engines.each do |_name, dir|
      Dir.chdir dir do
        next unless File.file? 'package.json'
        system("yarn") || abort("\n== yarn failed in #{dir} ==")
      end
    end
  end

  task :clean do
    Dir.chdir ManageIQ::UI::Classic::Engine.root do
      # clean up old bower install to prevent it from winning over npm
      system("rm -rf vendor/assets/bower_components")
    end
  end

  task :ui => ['update:clean', 'update:bower', 'update:yarn', 'webpack:compile']
end

namespace :webpack do
  task :server do
    root = ManageIQ::UI::Classic::Engine.root
    webpack_dev_server = root.join("bin", "webpack-dev-server").to_s
    system(webpack_dev_server) || abort("\n== webpack-dev-server failed ==")
  end

  [:compile, :clobber].each do |webpacker_task|
    task webpacker_task do
      # Run the `webpack:compile` tasks without a fully loaded environment,
      # since when doing an appliance/docker build, a database isn't
      # available for the :environment task (prerequisite for
      # 'webpacker:compile') to function.
      EvmRakeHelper.with_dummy_database_url_configuration do
        Dir.chdir ManageIQ::UI::Classic::Engine.root do
          Rake::Task["webpack:paths"].invoke
          Rake::Task["webpacker:#{webpacker_task}"].invoke
        end
      end
    end
  end

  task :paths do
    paths_config = ManageIQ::UI::Classic::Engine.root.join('config/webpack/paths.json')

    File.open(paths_config, 'w') do |file|
      file.write(JSON.pretty_generate(
        :info    => "This file is autogenerated by rake webpack:paths, do not edit",
        :output  => Rails.root.to_s,
        :engines => asset_engines_plugins_hash,
      ) + "\n")
    end
  end
end

# compile and clobber when running assets:* tasks
if Rake::Task.task_defined?("assets:precompile")
  Rake::Task["assets:precompile"].enhance do
    Rake::Task["webpack:compile"].invoke
  end

  Rake::Task["assets:precompile"].actions.each do |action|
    if action.source_location[0].include?(File.join("lib", "tasks", "webpacker"))
      Rake::Task["assets:precompile"].actions.delete(action)
    end
  end
end

if Rake::Task.task_defined?("assets:clobber")
  Rake::Task["assets:clobber"].enhance do
    Rake::Task["webpack:clobber"].invoke
  end

  Rake::Task["assets:clobber"].actions.each do |action|
    if action.source_location[0].include?(File.join("lib", "tasks", "webpacker"))
      Rake::Task["assets:clobber"].actions.delete(action)
    end
  end
end

# yarn:install is a rails 5.1 task, webpacker:compile needs it
namespace :yarn do
  task :install do
    puts 'yarn:install called, not doing anything'
  end
end

# need the initializer for the rake tasks to work
require ManageIQ::UI::Classic::Engine.root.join('config/initializers/webpacker.rb')
unless Rake::Task.task_defined?("webpacker")
  load 'tasks/webpacker.rake'
  load 'tasks/webpacker/compile.rake'
  load 'tasks/webpacker/clobber.rake'
  load 'tasks/webpacker/verify_install.rake'         # needed by compile
  load 'tasks/webpacker/check_node.rake'             # needed by verify_install
  load 'tasks/webpacker/check_yarn.rake'             # needed by verify_install
  load 'tasks/webpacker/check_webpack_binstubs.rake' # needed by verify_install
end

# This is normally handled by the lib/vmdb/inflectors.rb of manageiq, but might
# not be loaded if this is called from this repo.  Doesn't hurt (much) to have
# this here, and shouldn't create duplicates (won't be in place in the booted
# application).
ActiveSupport::Inflector.inflections do |inflect|
  inflect.acronym "ManageIQ"
end

def asset_engines
  all_engines = Rails::Engine.subclasses.each_with_object({}) do |engine, acc|
    acc[engine] = engine.root.realpath.to_s
  end

  # we only read assets from app/javascript/, filtering engines based on existence of that dir
  all_engines.select do |_name, path|
    Dir.exist? File.join(path, 'app', 'javascript')
  end
end

def asset_engines_plugins_hash
  asset_engines.each_with_object({}) do |(engine, path), plugin_hash|
    # remove '::Engine' from the constant name, underscore it, and replace
    # backslashes with dashes
    plugin_name = engine.to_s.split("::")[0..-2].join("::").underscore.tr("/", "-")

    plugin_hash[plugin_name] = path
  end
end
